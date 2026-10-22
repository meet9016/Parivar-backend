const jwt = require('jsonwebtoken');
const User = require('../models/userModels');
const { apiResponse } = require('../utils/apiResponse');
const { sendSMS } = require('../utils/smsService');

const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/authConfig');
const MEMBER_TOKEN_EXPIRES_IN = JWT_EXPIRES_IN;

const requestData = (req) => ({ ...req.query, ...req.body });

const tokenPayloadFor = (member, sessionId = '', tenantCode = '') => ({
  id: member._id,
  first_name: member.first_name || '',
  middle_name: member.middle_name || '',
  last_name: member.last_name || '',
  number: member.number || '',
  session_id: sessionId || member.session_id || '',
  tenant_code: tenantCode || ''
});

const signArchiveToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MEMBER_TOKEN_EXPIRES_IN });
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const STATIC_OTP_NUMBERS = {
  '9510582641': '123456',
  '9876543210': '111111',
};
const getStaticConfig = (numStr) => {
  if (!numStr) return null;
  const digits = String(numStr).replace(/\D/g, '').slice(-10);
  return STATIC_OTP_NUMBERS[digits] ? { number: digits, otp: STATIC_OTP_NUMBERS[digits] } : null;
};

const login = async (req, res) => {
  try {
    const { number, otp, fcm_token } = requestData(req);

    if (!number) return apiResponse(res, 400, 'Number is required');

    const rawNumber = String(number).trim();
    const cleanNumber = rawNumber.replace(/\D/g, '').slice(-10);

    const user = await User.findOne({
      $or: [
        { number: rawNumber },
        { number: cleanNumber },
        { number: `+91${cleanNumber}` },
        { number: `91${cleanNumber}` }
      ]
    }).select('-password');

    if (!user) return apiResponse(res, 400, 'Invalid number');

    const now = new Date();
    const staticConfig = getStaticConfig(rawNumber) || getStaticConfig(user.number);


    if (!otp) {
      if (staticConfig) {
        user.otp = staticConfig.otp;
        user.otp_expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours valid
        user.otp_last_sent = now;
        await user.save();
        console.log(`[AUTH] Static OTP ${staticConfig.otp} set for test number ${cleanNumber} (No SMS sent)`);
        return apiResponse(res, 200, 'OTP sent successfully', { otp: staticConfig.otp });
      }

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
    const isStaticMatch = staticConfig && (String(otp) === staticConfig.otp || String(otp) === '1234');

    if (!isStaticMatch) {
      // 1. Check if an OTP transaction exists or matches
      if (!user.otp || user.otp !== String(otp)) {
        return apiResponse(res, 400, 'Invalid OTP');
      }

      // 2. Check if the 10-minute expiration has passed
      if (now > new Date(user.otp_expiry)) {
        return apiResponse(res, 400, 'OTP has expired');
      }
    }

    // 3. Clear token states immediately to avoid replay attacks
    user.otp = null;
    user.otp_expiry = null;
    
    if (fcm_token) user.fcm_token = fcm_token;

    // Single-device login: Generate new unique session_id to invalidate older devices
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    user.session_id = sessionId;
    await user.save();

    // 4. Issue Session Tokens with 48h validity & session tracking
    let tenantSlug = req.headers['x-tenant-id']?.toLowerCase() || '';
    if (!tenantSlug && req.hostname && req.hostname.endsWith('.parivar.me')) {
      const parts = req.hostname.split('.');
      if (parts.length >= 3 && parts[0] !== 'www') tenantSlug = parts[0].toLowerCase();
    }

    const payload = tokenPayloadFor(user, sessionId, tenantSlug);
    const token = signArchiveToken(payload);

    return apiResponse(res, 200, 'Login successful', { token, user: payload });

  } catch (error) {
    return apiResponse(res, 500, 'Error in login', { error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const { getTokenFromRequest } = require('../middleware/auth');
    const token = getTokenFromRequest(req);
    let userId = req.user?._id || req.user?.id;

    if (!userId && token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
        userId = decoded.id || decoded._id || decoded.userId;
      } catch (_) {}
    }

    const reqFcmToken = req.body?.fcm_token || req.query?.fcm_token;
    const UserModel = req.tenantConn?.models?.User || User;

    if (userId) {
      await UserModel.findByIdAndUpdate(userId, {
        session_id: null,
        fcm_token: ''
      });
    }

    if (reqFcmToken && typeof reqFcmToken === 'string' && reqFcmToken.trim()) {
      await UserModel.updateMany(
        { fcm_token: reqFcmToken.trim() },
        { $set: { fcm_token: '' } }
      );
    }

    return apiResponse(res, 200, 'Logged out successfully');
  } catch (error) {
    console.error('[LOGOUT ERROR]:', error);
    return apiResponse(res, 200, 'Logged out successfully');
  }
};

const versionCode = async (req, res) => {
  return apiResponse(res, 200, 'Version code fetch successfully', []);
};

module.exports = { login, logout, versionCode };