const jwt = require('jsonwebtoken');
const User = require('../models/userModels');
const { apiResponse } = require('../utils/apiResponse');
const { sendSMS } = require('../utils/smsService');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfamilykey';
const MEMBER_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

const requestData = (req) => ({ ...req.query, ...req.body });

const tokenPayloadFor = (member) => ({
  id: member._id,
  first_name: member.first_name || '',
  middle_name: member.middle_name || '',
  last_name: member.last_name || '',
  number: member.number || '',
});

const signArchiveToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MEMBER_TOKEN_EXPIRES_IN });
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const login = async (req, res) => {
  try {
    const { number, otp, fcm_token } = requestData(req);

    if (!number) return apiResponse(res, 400, 'Number is required');

    const user = await User.findOne({ number: String(number) }).select('-password');
    if (!user) return apiResponse(res, 400, 'Invalid number');

    const now = new Date();

    // ==========================================
    // SCENARIO A: REQUEST / RESEND OTP
    // ==========================================
    if (!otp) {
      // 1. Check & Reset Daily Rate Limit Tracker if 24 hours have passed
      if (!user.otp_reset_day || now - new Date(user.otp_reset_day) >= 24 * 60 * 60 * 1000) {
        user.otp_count = 0;
        user.otp_reset_day = now;
      }

      // 2. Strict Limit: Only 3 requests per day
      // if (user.otp_count >= 3) {
      //   return apiResponse(res, 429, 'Daily OTP request limit reached. Try again tomorrow.');
      // }

      // 3. Cooldown Control: Must wait 1 minute before requesting a resend
      if (user.otp_last_sent && (now - new Date(user.otp_last_sent) < 60 * 1000)) {
        const secondsLeft = Math.ceil((60 * 1000 - (now - new Date(user.otp_last_sent))) / 1000);
        return apiResponse(res, 429, `Please wait ${secondsLeft} seconds before requesting another OTP.`);
      }

      const generatedOtp = generateOTP();

      // Update rate limits and 10-minute expiry window
      user.otp = generatedOtp;
      user.otp_expiry = new Date(now.getTime() + 10 * 60 * 1000);
      user.otp_last_sent = now;
      user.otp_count += 1;
      await user.save();

      // Dispatch via SMS gateway helper
      const smsResult = await sendSMS(number, generatedOtp);

      if (!smsResult.success) {
        console.warn(`[AUTH WARNING] SMS delivery failed for ${number}: ${smsResult.error}`);
        // Still return 200 but inform user of SMS issue
        return apiResponse(res, 200, 'OTP generated but SMS delivery may have failed. Please check your network or try again.');
      }

      return apiResponse(res, 200, 'OTP sent successfully');
    }

    // ==========================================
    // SCENARIO B: VERIFY OTP
    // ==========================================
    // 1. Check if an OTP transaction exists or matches
    if (!user.otp || user.otp !== String(otp)) {
      return apiResponse(res, 400, 'Invalid OTP');
    }

    // 2. Check if the 10-minute expiration has passed
    if (now > new Date(user.otp_expiry)) {
      return apiResponse(res, 400, 'OTP has expired');
    }

    // 3. Clear token states immediately to avoid replay attacks
    user.otp = null;
    user.otp_expiry = null;
    
    if (fcm_token) user.fcm_token = fcm_token;
    await user.save();

    // 4. Issue Session Tokens
    const payload = tokenPayloadFor(user);
    const token = signArchiveToken(payload);

    return apiResponse(res, 200, 'Login successful', { token, user: payload });

  } catch (error) {
    return apiResponse(res, 500, 'Error in login', { error: error.message });
  }
};

const versionCode = async (req, res) => {
  return apiResponse(res, 200, 'Version code fetch successfully', []);
};

module.exports = { login, versionCode };