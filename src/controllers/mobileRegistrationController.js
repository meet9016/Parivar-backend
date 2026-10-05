const User = require('../models/userModels');
const Master = require('../models/masterModel');
const { apiResponse } = require('../utils/apiResponse');
const { prepareFamilyFields } = require('../utils/familyHelper');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfamilykey';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '365d';

// Generate next unique member_id sequence
const getNextMemberId = async () => {
  const latestUser = await User.findOne({ member_id: /^\d+$/ })
    .sort({ createdAt: -1, _id: -1 })
    .select('member_id')
    .lean();

  if (latestUser && !isNaN(Number(latestUser.member_id))) {
    return String(Number(latestUser.member_id) + 1);
  }
  const count = await User.countDocuments();
  return String(count + 1);
};

// Map & format response helper
const formatRegistrationUser = (user) => {
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.password;
  delete u.otp;
  delete u.otp_expiry;
  return u;
};

const parseRequestBody = (req) => {
  return { ...req.query, ...req.body };
};

const parseJsonIfNeeded = (val) => {
  if (val === undefined || val === null) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'string' ? parseJsonIfNeeded(parsed) : parsed;
      } catch (e) {
        return val;
      }
    }
    return val;
  }
  return val;
};

/**
 * STEP 1: Personal Information
 * Profile photo, Father/Husband Name, Patti/Pargana, Gender, Blood Group, DOB, Marital Status
 */
const saveStep1 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const {
      user_id,
      number,
      phone,
      mobile,
      first_name,
      middle_name,
      last_name,
      father_husband_name,
      patti_para_pargana,
      peta_jati,
      gender,
      blood_group,
      dob,
      marital_status,
      profile_image,
      image,
      photo,
      avatar
    } = data;

    const rawNum = number || phone || mobile || '';
    const cleanNumber = String(rawNum || '').trim().replace(/\D/g, '').slice(-10);

    let user;
    const targetUserId = user_id || (req.user && req.user._id);

    if (targetUserId) {
      user = await User.findById(targetUserId);
    } else if (cleanNumber) {
      user = await User.findOne({
        $or: [
          { number: cleanNumber },
          { number: `+91${cleanNumber}` },
          { number: `91${cleanNumber}` }
        ]
      });
    }

    const extractSingleUrl = (val) => {
      if (Array.isArray(val)) {
        return val.find(v => typeof v === 'string' && v.trim().length > 0) || '';
      }
      return typeof val === 'string' ? val.trim() : '';
    };

    const imgUrl = extractSingleUrl(profile_image) || extractSingleUrl(image) || extractSingleUrl(photo) || extractSingleUrl(avatar) || (req.file ? `/uploads/${req.file.filename}` : '');

    const normalizeGender = (g) => {
      if (!g) return '';
      const trimmed = String(g).trim().toLowerCase();
      if (trimmed === 'male' || trimmed === 'm') return 'Male';
      if (trimmed === 'female' || trimmed === 'f') return 'Female';
      if (trimmed === 'other' || trimmed === 'o') return 'Other';
      return '';
    };

    const cleanGender = normalizeGender(gender);

    if (!user) {
      if (!cleanNumber) {
        return apiResponse(res, 400, 'Primary phone number is required to start registration');
      }

      const nextMemberId = await getNextMemberId();

      user = new User({
        member_id: nextMemberId,
        number: cleanNumber,
        first_name: first_name || father_husband_name || 'Member',
        middle_name: middle_name || '',
        last_name: last_name || '',
        father_husband_name: father_husband_name || '',
        patti_para_pargana: patti_para_pargana || '',
        peta_jati: peta_jati || '',
        gender: cleanGender,
        blood_group: blood_group || '',
        dob: dob ? new Date(dob) : undefined,
        marital_status: marital_status || '',
        profile_image: imgUrl || '',
        image: imgUrl || '',
        registration_step: 1,
        registration_status: 'in_progress',
        status: 0,
        familyHead: true,
        relation: 'Self'
      });
    } else {
      if (cleanNumber) user.number = cleanNumber;
      if (first_name) user.first_name = first_name;
      if (middle_name !== undefined) user.middle_name = middle_name;
      if (last_name !== undefined) user.last_name = last_name;
      if (father_husband_name) user.father_husband_name = father_husband_name;
      if (patti_para_pargana !== undefined) user.patti_para_pargana = patti_para_pargana;
      if (peta_jati !== undefined) user.peta_jati = peta_jati;
      if (cleanGender) user.gender = cleanGender;
      if (blood_group !== undefined) user.blood_group = blood_group;
      if (dob) user.dob = new Date(dob);
      if (marital_status !== undefined) user.marital_status = marital_status;
      if (imgUrl) {
        user.profile_image = imgUrl;
        user.image = imgUrl;
      }
      user.registration_step = Math.max(user.registration_step || 1, 1);
    }

    await user.save();

    return apiResponse(res, 200, 'Step 1: Personal details saved successfully', {
      user_id: String(user._id),
      member_id: user.member_id,
      step: 1,
      personal_details: {
        first_name: user.first_name,
        middle_name: user.middle_name,
        last_name: user.last_name,
        father_husband_name: user.father_husband_name,
        number: user.number,
        patti_para_pargana: user.patti_para_pargana,
        peta_jati: user.peta_jati,
        gender: user.gender,
        blood_group: user.blood_group,
        dob: user.dob,
        marital_status: user.marital_status,
        profile_image: user.profile_image
      }
    });
  } catch (error) {
    console.error('Error saving step 1:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 1 details');
  }
};

/**
 * STEP 2: Family Details
 * Multiple family members array: [{ name, relation, mobile, age, dob, gender }]
 */
const saveStep2 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const targetUserId = data.user_id || (req.user && req.user._id);

    if (!targetUserId) {
      return apiResponse(res, 400, 'User ID is required');
    }

    const headUser = await User.findById(targetUserId);
    if (!headUser) {
      return apiResponse(res, 404, 'User not found');
    }

    let rawMembers = data.family_members || data.members || data['family_members[]'] || data['members[]'] || [];
    rawMembers = parseJsonIfNeeded(rawMembers);
    if (typeof rawMembers === 'string') {
      try { rawMembers = JSON.parse(rawMembers); } catch (e) { }
    }
    const membersList = Array.isArray(rawMembers) ? rawMembers : (rawMembers ? [rawMembers] : []);
    const createdMembers = [];

    // Delete previously added family members in draft if any
    await User.deleteMany({ parent_member_id: headUser.member_id, relation: { $ne: 'Self' } });

    for (let mem of membersList) {
      let item = parseJsonIfNeeded(mem);
      if (typeof item === 'string') {
        try { item = JSON.parse(item); } catch (e) { }
      }
      if (!item || typeof item !== 'object') continue;
      const memName = String(item.name || `${item.first_name || ''} ${item.last_name || ''}` || '').trim();
      if (!memName && !item.first_name) continue;

      const memNextId = await getNextMemberId();
      const names = memName.split(' ');
      const fName = item.first_name || names[0] || '';
      const lName = item.last_name || (names.length > 1 ? names.slice(1).join(' ') : headUser.last_name || '');

      let calculatedDob;
      if (item.dob) {
        calculatedDob = new Date(item.dob);
      } else if (item.age) {
        const now = new Date();
        now.setFullYear(now.getFullYear() - Number(item.age));
        calculatedDob = now;
      }

      const newFamilyMember = new User({
        member_id: memNextId,
        parent_member_id: headUser.member_id,
        first_name: fName,
        middle_name: item.middle_name || headUser.first_name || '',
        last_name: lName,
        number: item.mobile || item.number || headUser.number,
        relation: item.relation || 'Other',
        dob: calculatedDob,
        gender: item.gender || '',
        state_id: headUser.state_id || '',
        district_id: headUser.district_id || '',
        city_id: headUser.city_id || '',
        village: headUser.village || '',
        address: headUser.address || '',
        pincode: headUser.pincode || '',
        family_head: { id: headUser._id, name: `${headUser.first_name || ''} ${headUser.last_name || ''}`.trim() },
        familyHead: false,
        status: 0,
        registration_status: 'in_progress'
      });

      await newFamilyMember.save();
      createdMembers.push({
        id: String(newFamilyMember._id),
        member_id: newFamilyMember.member_id,
        name: `${newFamilyMember.first_name} ${newFamilyMember.last_name || ''}`.trim(),
        relation: newFamilyMember.relation,
        mobile: newFamilyMember.number,
        dob: newFamilyMember.dob,
        gender: newFamilyMember.gender
      });
    }

    headUser.registration_step = Math.max(headUser.registration_step || 1, 2);
    await headUser.save();

    return apiResponse(res, 200, 'Step 2: Family details saved successfully', {
      user_id: String(headUser._id),
      step: 2,
      family_count: createdMembers.length,
      family_members: createdMembers
    });
  } catch (error) {
    console.error('Error saving step 2:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 2 details');
  }
};

/**
 * STEP 3: Address Information
 * State, District, City/Village, Complete Address, Pincode
 */
const saveStep3 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { user_id, state_id, district_id, city_id, village_id, village, address, complete_address, pincode } = data;
    const targetUserId = user_id || (req.user && req.user._id);

    if (!targetUserId) {
      return apiResponse(res, 400, 'User ID is required');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return apiResponse(res, 404, 'User not found');
    }

    if (state_id !== undefined) user.state_id = state_id;
    if (district_id !== undefined) user.district_id = district_id;
    if (city_id !== undefined) user.city_id = city_id;
    if (village_id !== undefined) user.village_id = village_id;
    if (village !== undefined) user.village = village;
    if (complete_address || address) user.address = complete_address || address;
    if (pincode !== undefined) user.pincode = String(pincode).trim();

    user.registration_step = Math.max(user.registration_step || 1, 3);
    await user.save();

    // Also sync address to related family members
    await User.updateMany(
      { parent_member_id: user.member_id },
      {
        state_id: user.state_id,
        district_id: user.district_id,
        city_id: user.city_id,
        village: user.village,
        address: user.address,
        pincode: user.pincode
      }
    );

    return apiResponse(res, 200, 'Step 3: Address details saved successfully', {
      user_id: String(user._id),
      step: 3,
      address_details: {
        state_id: user.state_id,
        district_id: user.district_id,
        city_id: user.city_id,
        village: user.village,
        complete_address: user.address,
        pincode: user.pincode
      }
    });
  } catch (error) {
    console.error('Error saving step 3:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 3 details');
  }
};

/**
 * STEP 4: Occupation
 * Occupation Type (Business, Job, Farming, Homemaker, Student, etc.) & Business Details
 */
const saveStep4 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const {
      user_id,
      occupation,
      occupation_type,
      business_name,
      business_type,
      business_address,
      business_mobile,
      business_email,
      gst_number,
      website
    } = data;

    const targetUserId = user_id || (req.user && req.user._id);
    if (!targetUserId) {
      return apiResponse(res, 400, 'User ID is required');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return apiResponse(res, 404, 'User not found');
    }

    const occType = occupation || occupation_type || '';
    user.occupation = occType;
    user.occupation_type = occType;

    user.occupation_details = {
      business_name: business_name || user.occupation_details?.business_name || '',
      business_type: business_type || user.occupation_details?.business_type || '',
      business_address: business_address || user.occupation_details?.business_address || '',
      business_mobile: business_mobile || user.occupation_details?.business_mobile || '',
      business_email: business_email || user.occupation_details?.business_email || '',
      gst_number: gst_number || user.occupation_details?.gst_number || '',
      website: website || user.occupation_details?.website || ''
    };

    user.registration_step = Math.max(user.registration_step || 1, 4);
    await user.save();

    return apiResponse(res, 200, 'Step 4: Occupation details saved successfully', {
      user_id: String(user._id),
      step: 4,
      occupation: user.occupation,
      occupation_details: user.occupation_details
    });
  } catch (error) {
    console.error('Error saving step 4:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 4 details');
  }
};

/**
 * STEP 5: Documents
 * Upload identity proof documents (Aadhaar, PAN, Voter ID, Driving License, Passport)
 */
const saveStep5 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const {
      user_id,
      aadhaar_card,
      pan_card,
      voter_id,
      driving_license,
      passport,
      document,
      file
    } = data;

    const targetUserId = user_id || (req.user && req.user._id);
    if (!targetUserId) {
      return apiResponse(res, 400, 'User ID is required');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return apiResponse(res, 404, 'User not found');
    }

    const extractSingleUrl = (val) => {
      if (Array.isArray(val)) {
        return val.find(v => typeof v === 'string' && v.trim().length > 0) || '';
      }
      return typeof val === 'string' ? val.trim() : '';
    };

    user.documents = {
      aadhaar_card: extractSingleUrl(aadhaar_card) || user.documents?.aadhaar_card || '',
      pan_card: extractSingleUrl(pan_card) || user.documents?.pan_card || '',
      voter_id: extractSingleUrl(voter_id) || user.documents?.voter_id || '',
      driving_license: extractSingleUrl(driving_license) || user.documents?.driving_license || '',
      passport: extractSingleUrl(passport) || extractSingleUrl(document) || extractSingleUrl(file) || user.documents?.passport || ''
    };

    user.registration_step = Math.max(user.registration_step || 1, 5);
    await user.save();

    return apiResponse(res, 200, 'Step 5: Documents saved successfully', {
      user_id: String(user._id),
      step: 5,
      documents: user.documents
    });
  } catch (error) {
    console.error('Error saving step 5:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 5 documents');
  }
};

const findRegistrationUser = async (data, req) => {
  const targetUserId = req.params?.user_id || data.user_id || (req.user && req.user._id);
  if (targetUserId) {
    const byId = await User.findById(targetUserId);
    if (byId) return byId;
  }
  const rawNum = data.number || data.phone || data.mobile || '';
  const cleanNumber = String(rawNum || '').trim().replace(/\D/g, '').slice(-10);
  if (cleanNumber) {
    return await User.findOne({
      $or: [
        { number: cleanNumber },
        { number: `+91${cleanNumber}` },
        { number: `91${cleanNumber}` }
      ]
    });
  }
  return null;
};

/**
 * STEP 6: Review Summary
 * Fetch complete profile details & family members for final review before submission
 */
const getReviewSummary = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const user = await findRegistrationUser(data, req);
    if (!user) {
      return apiResponse(res, 404, 'User not found. Provide valid user_id or number.');
    }

    const familyMembers = await User.find({ parent_member_id: user.member_id, relation: { $ne: 'Self' } });

    return apiResponse(res, 200, 'Review summary fetched successfully', {
      user: formatRegistrationUser(user),
      family_members: familyMembers.map(formatRegistrationUser),
      registration_step: user.registration_step || 1,
      registration_status: user.registration_status || 'in_progress',
      is_completed_5_steps: (user.registration_step || 1) >= 5
    });
  } catch (error) {
    console.error('Error fetching review summary:', error);
    return apiResponse(res, 500, error.message || 'Error fetching review summary');
  }
};

/**
 * STEP 7 / Final Action: Confirm & Submit for Review
 * Submits the complete membership application for admin approval
 */
const submitForReview = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const user = await findRegistrationUser(data, req);
    if (!user) {
      return apiResponse(res, 404, 'User not found. Provide valid user_id or number.');
    }

    user.registration_step = 6;
    user.registration_status = 'pending_review';
    user.status = 0; // 0 = Pending Admin Verification
    await user.save();

    await User.updateMany(
      { parent_member_id: user.member_id },
      { registration_status: 'pending_review', status: 0 }
    );

    // Generate login token
    const token = jwt.sign(
      {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        number: user.number
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return apiResponse(res, 200, 'Your membership has been submitted for review successfully', {
      token,
      user_id: user._id,
      member_id: user.member_id,
      registration_status: user.registration_status,
      user: formatRegistrationUser(user)
    });
  } catch (error) {
    console.error('Error submitting for review:', error);
    return apiResponse(res, 500, error.message || 'Error submitting application');
  }
};

/**
 * ALL-IN-ONE Full Registration Endpoint (Alternative single POST)
 */
const completeFullRegistration = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const {
      first_name,
      middle_name,
      last_name,
      father_husband_name,
      patti_para_pargana,
      peta_jati,
      gender,
      blood_group,
      dob,
      marital_status,
      number,
      phone,
      mobile,
      email,
      profile_image,
      image,
      photo,
      avatar,
      family_members = [],
      state_id,
      district_id,
      city_id,
      village_id,
      village,
      address,
      complete_address,
      pincode,
      occupation,
      occupation_type,
      business_name,
      business_type,
      business_address,
      business_mobile,
      business_email,
      gst_number,
      website,
      aadhaar_card,
      pan_card,
      voter_id,
      driving_license,
      passport
    } = data;

    const rawNum = number || phone || mobile || '';
    const cleanNumber = String(rawNum || '').trim().replace(/\D/g, '').slice(-10);
    if (!cleanNumber) {
      return apiResponse(res, 400, 'Primary phone number is required');
    }

    let user = await User.findOne({
      $or: [
        { number: cleanNumber },
        { number: `+91${cleanNumber}` },
        { number: `91${cleanNumber}` }
      ]
    });

    const nextMemberId = user ? user.member_id : await getNextMemberId();
    const imgUrl = profile_image || image || photo || avatar || (req.file ? `/uploads/${req.file.filename}` : '');

    if (!user) {
      user = new User({
        member_id: nextMemberId,
        number: cleanNumber,
        familyHead: true,
        relation: 'Self'
      });
    }

    user.first_name = first_name || father_husband_name || user.first_name || 'Member';
    user.middle_name = middle_name || user.middle_name || '';
    user.last_name = last_name || user.last_name || '';
    user.father_husband_name = father_husband_name || user.father_husband_name || '';
    user.patti_para_pargana = patti_para_pargana || user.patti_para_pargana || '';
    user.peta_jati = peta_jati || user.peta_jati || '';
    user.gender = gender || user.gender || '';
    user.blood_group = blood_group || user.blood_group || '';
    if (dob) user.dob = new Date(dob);
    user.marital_status = marital_status || user.marital_status || '';
    if (email) user.email = email.toLowerCase().trim();
    if (imgUrl) {
      user.profile_image = imgUrl;
      user.image = imgUrl;
    }

    user.state_id = state_id || user.state_id || '';
    user.district_id = district_id || user.district_id || '';
    user.city_id = city_id || user.city_id || '';
    user.village_id = village_id || user.village_id || '';
    user.village = village || user.village || '';
    user.address = complete_address || address || user.address || '';
    user.pincode = pincode || user.pincode || '';

    const occType = occupation || occupation_type || user.occupation || '';
    user.occupation = occType;
    user.occupation_type = occType;
    user.occupation_details = {
      business_name: business_name || user.occupation_details?.business_name || '',
      business_type: business_type || user.occupation_details?.business_type || '',
      business_address: business_address || user.occupation_details?.business_address || '',
      business_mobile: business_mobile || user.occupation_details?.business_mobile || '',
      business_email: business_email || user.occupation_details?.business_email || '',
      gst_number: gst_number || user.occupation_details?.gst_number || '',
      website: website || user.occupation_details?.website || ''
    };

    user.documents = {
      aadhaar_card: aadhaar_card || user.documents?.aadhaar_card || '',
      pan_card: pan_card || user.documents?.pan_card || '',
      voter_id: voter_id || user.documents?.voter_id || '',
      driving_license: driving_license || user.documents?.driving_license || '',
      passport: passport || user.documents?.passport || ''
    };

    user.registration_step = 6;
    user.registration_status = 'pending_review';
    user.status = 0;

    await user.save();

    // Family members
    let rawMembers = family_members || data.members || [];
    rawMembers = parseJsonIfNeeded(rawMembers);
    if (Array.isArray(rawMembers) && rawMembers.length > 0) {
      await User.deleteMany({ parent_member_id: user.member_id, relation: { $ne: 'Self' } });
      for (const mem of rawMembers) {
        const item = parseJsonIfNeeded(mem);
        if (!item) continue;
        const memName = (item.name || `${item.first_name || ''} ${item.last_name || ''}`).trim();
        if (!memName && !item.first_name) continue;

        const memNextId = await getNextMemberId();
        const names = memName.split(' ');
        const fName = item.first_name || names[0] || '';
        const lName = item.last_name || (names.length > 1 ? names.slice(1).join(' ') : user.last_name || '');

        let calculatedDob;
        if (item.dob) calculatedDob = new Date(item.dob);
        else if (item.age) {
          const now = new Date();
          now.setFullYear(now.getFullYear() - Number(item.age));
          calculatedDob = now;
        }

        await new User({
          member_id: memNextId,
          parent_member_id: user.member_id,
          first_name: fName,
          middle_name: item.middle_name || user.first_name || '',
          last_name: lName,
          number: item.mobile || item.number || user.number,
          relation: item.relation || 'Other',
          dob: calculatedDob,
          gender: item.gender || '',
          state_id: user.state_id,
          district_id: user.district_id,
          city_id: user.city_id,
          village: user.village,
          address: user.address,
          pincode: user.pincode,
          family_head: { id: user._id, name: `${user.first_name || ''} ${user.last_name || ''}`.trim() },
          familyHead: false,
          status: 0,
          registration_status: 'pending_review'
        }).save();
      }
    }

    const token = jwt.sign(
      { id: user._id, first_name: user.first_name, last_name: user.last_name, number: user.number },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return apiResponse(res, 200, 'Registration completed and submitted for review', {
      token,
      user_id: user._id,
      member_id: user.member_id,
      registration_status: user.registration_status,
      user: formatRegistrationUser(user)
    });
  } catch (error) {
    console.error('Error in complete full registration:', error);
    return apiResponse(res, 500, error.message || 'Error completing registration');
  }
};

/**
 * ADMIN: Get list of registrations with flexible matching
 */
const getRegistrationsList = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', status = '', step = '' } = req.query;
    const query = {
      familyHead: true
    };

    if (status) {
      query.registration_status = status;
    } else {
      query.$or = [
        { registration_status: { $in: ['pending_review', 'in_progress', 'needs_correction', 'approved', 'rejected'] } },
        { registration_step: { $exists: true, $ne: null } },
        { status: 0 }
      ];
    }

    if (step) {
      query.registration_step = Number(step);
    }

    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { first_name: regex },
          { middle_name: regex },
          { last_name: regex },
          { number: regex },
          { member_id: regex },
          { village: regex },
          { patti_para_pargana: regex }
        ]
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        const familyCount = await User.countDocuments({ parent_member_id: u.member_id, relation: { $ne: 'Self' } });
        return {
          ...formatRegistrationUser(u),
          family_members_count: familyCount
        };
      })
    );

    return apiResponse(res, 200, 'Registrations fetched successfully', {
      registrations: enrichedUsers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    });
  } catch (error) {
    console.error('Error fetching registrations list:', error);
    return apiResponse(res, 500, error.message || 'Error fetching registrations');
  }
};

/**
 * ADMIN: Get single registration detailed data (All 5 Steps + Family Members)
 */
const getRegistrationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).lean();
    if (!user) {
      return apiResponse(res, 404, 'Registration not found');
    }

    const familyMembers = await User.find({ parent_member_id: user.member_id, relation: { $ne: 'Self' } }).lean();

    return apiResponse(res, 200, 'Registration details fetched successfully', {
      user: formatRegistrationUser(user),
      family_members: familyMembers.map(formatRegistrationUser)
    });
  } catch (error) {
    console.error('Error fetching registration details:', error);
    return apiResponse(res, 500, error.message || 'Error fetching registration details');
  }
};

/**
 * ADMIN: Approve registration -> converts to active member (status = 1, registration_status = 'approved')
 */
const approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return apiResponse(res, 404, 'Registration not found');
    }

    user.status = 1; // Active member
    user.registration_status = 'approved';
    user.rejection_reason = '';
    user.correction_remarks = '';
    await user.save();

    // Approve all family members under this head
    await User.updateMany(
      { parent_member_id: user.member_id },
      { status: 1, registration_status: 'approved', rejection_reason: '', correction_remarks: '' }
    );

    return apiResponse(res, 200, 'Registration approved successfully. Member is now active in directory.', {
      user: formatRegistrationUser(user)
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    return apiResponse(res, 500, error.message || 'Error approving registration');
  }
};

/**
 * ADMIN: Reject registration with reason
 */
const rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, remarks } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return apiResponse(res, 404, 'Registration not found');
    }

    user.status = 0; // Inactive / Rejected
    user.registration_status = 'rejected';
    user.rejection_reason = reason || remarks || 'Application rejected by Admin';
    await user.save();

    await User.updateMany(
      { parent_member_id: user.member_id },
      { status: 0, registration_status: 'rejected', rejection_reason: user.rejection_reason }
    );

    return apiResponse(res, 200, 'Registration marked as rejected', {
      user: formatRegistrationUser(user)
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    return apiResponse(res, 500, error.message || 'Error rejecting registration');
  }
};

/**
 * ADMIN: Request correction from user (Wrong image, wrong mobile, missing doc, etc.)
 */
const requestCorrectionRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks, fields_to_correct, reason } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return apiResponse(res, 404, 'Registration not found');
    }

    const note = remarks || reason || 'Please correct your details';
    user.registration_status = 'needs_correction';
    user.correction_remarks = note;
    user.fields_to_correct = fields_to_correct || [];
    await user.save();

    await User.updateMany(
      { parent_member_id: user.member_id },
      { registration_status: 'needs_correction', correction_remarks: note }
    );

    return apiResponse(res, 200, 'Correction requested successfully. User can update required fields.', {
      user: formatRegistrationUser(user)
    });
  } catch (error) {
    console.error('Error requesting correction:', error);
    return apiResponse(res, 500, error.message || 'Error requesting correction');
  }
};

module.exports = {
  saveStep1,
  saveStep2,
  saveStep3,
  saveStep4,
  saveStep5,
  getReviewSummary,
  submitForReview,
  completeFullRegistration,
  getRegistrationsList,
  getRegistrationDetails,
  approveRegistration,
  rejectRegistration,
  requestCorrectionRegistration
};
