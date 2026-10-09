const mongoose = require('mongoose');
const User = require('../models/userModels');
const Role = require('../models/roleModel');
const RegistrationRequest = require('../models/registrationRequestModel');
const Master = require('../models/masterModel');
const City = require('../models/cityModel');
const State = require('../models/stateModel');
const Country = require('../models/countryModel');
const { apiResponse } = require('../utils/apiResponse');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfamilykey';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '365d';

// Generate next unique member_id sequence for Users
const getNextMemberId = async () => {
  const allUsers = await User.find({}).select('member_id').lean();
  const maxId = allUsers.reduce((max, u) => {
    const num = Number(u.member_id);
    return (!isNaN(num) && num > max) ? num : max;
  }, 0);
  return String(maxId + 1);
};

// Cached connection for cross-tenant fallback master resolution
let fallbackTenantConn = null;
const getFallbackTenantConnection = async () => {
  if (fallbackTenantConn && fallbackTenantConn.readyState === 1) {
    return fallbackTenantConn;
  }
  try {
    const currentUri = process.env.MONGO_URI || '';
    const isChaudhary = currentUri.includes('chaudhary');
    const fallbackUri = isChaudhary
      ? 'mongodb+srv://chovatiya:prince1353@chovatiya.afm9iqw.mongodb.net/chovatiya'
      : 'mongodb+srv://chaudhary:prince1353@chaudhary.wlpd3te.mongodb.net/chaudhary';

    const mongoose = require('mongoose');
    fallbackTenantConn = await mongoose.createConnection(fallbackUri, {
      serverSelectionTimeoutMS: 20000,
      tls: true
    }).asPromise();
    return fallbackTenantConn;
  } catch (e) {
    console.error('Failed to establish fallback tenant connection:', e.message);
    return null;
  }
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

const extractSingleUrl = (val) => {
  if (Array.isArray(val)) {
    return val.find(v => typeof v === 'string' && v.trim().length > 0) || '';
  }
  return typeof val === 'string' ? val.trim() : '';
};

const normalizeGender = (g) => {
  if (!g) return '';
  const trimmed = String(g).trim().toLowerCase();
  if (trimmed === 'male' || trimmed === 'm') return 'Male';
  if (trimmed === 'female' || trimmed === 'f') return 'Female';
  if (trimmed === 'other' || trimmed === 'o') return 'Other';
  return '';
};

// System/internal fields that should NOT be stored inside step payloads
const SYSTEM_FIELDS = new Set([
  '_id', '__v', 'id', 'registration_id', 'request_id', 'user_id', 'number', 'phone', 'mobile',
  'is_approved', 'status', 'current_step', 'step', 'registration_step', 'registration_status',
  'approved_at', 'approved_by', 'rejection_reason', 'correction_remarks', 'fields_to_correct',
  'member_id', 'createdAt', 'updatedAt', 'family_members', 'members'
]);

// Allowed fields per step to prevent cross-step pollution
const STEP1_KEYS = new Set([
  'first_name', 'middle_name', 'last_name', 'number', 'gender',
  'blood_group', 'dob', 'marital_status', 'patti_para_pargana',
  'peta_jati', 'profile_image', 'image', 'photo', 'avatar'
]);

// Helper to sanitize strings (trim and remove trailing commas)
const sanitizeVal = (val) => {
  if (typeof val === 'string') {
    return val.trim().replace(/^,+|,+$/g, '').trim();
  }
  return val;
};

// Strip non-step keys from a raw data object
const filterByAllowedKeys = (rawData, allowedSet) => {
  const filtered = {};
  for (const [key, val] of Object.entries(rawData || {})) {
    if (allowedSet.has(key) && val !== undefined && val !== null && val !== '') {
      filtered[key] = sanitizeVal(val);
    }
  }
  return filtered;
};

// Strip system/internal keys from a raw data object before storing in step
const cleanForStep = (rawData) => {
  const cleaned = {};
  for (const [key, val] of Object.entries(rawData || {})) {
    if (!SYSTEM_FIELDS.has(key) && val !== undefined && val !== null && val !== '') {
      cleaned[key] = sanitizeVal(val);
    }
  }
  return cleaned;
};

// Helper to find or create registration request
const findOrCreateRequest = async (data, req) => {
  const targetId = data.registration_id || data.request_id || data.user_id || req.params?.id || req.params?.user_id;
  const rawNum = data.number || data.phone || data.mobile || '';
  const cleanNumber = String(rawNum || '').trim().replace(/\D/g, '').slice(-10);

  let regRequest = null;

  // 1. Try by ID first (most accurate)
  if (targetId && /^[0-9a-fA-F]{24}$/.test(String(targetId))) {
    regRequest = await RegistrationRequest.findById(targetId);
  }

  if (!regRequest && cleanNumber) {
    const firstName = (data.first_name || '').trim().toLowerCase();
    const lastName = (data.last_name || '').trim().toLowerCase();

    // 2. Find latest unapproved request for this phone number
    const existingRequests = await RegistrationRequest.find({
      number: cleanNumber,
      is_approved: false
    }).sort({ createdAt: -1 }).lean();

    if (existingRequests.length > 0) {
      // If name is provided, match by name to avoid wrong duplicate
      if (firstName) {
        const nameMatch = existingRequests.find(r => {
          const rFirst = (r.first_name || '').trim().toLowerCase();
          const rLast = (r.last_name || '').trim().toLowerCase();
          // Same first name → treat as same person (names can slightly differ)
          return rFirst === firstName || (rFirst === firstName && rLast === lastName);
        });
        regRequest = nameMatch
          ? await RegistrationRequest.findById(nameMatch._id)
          : null;
      }

      // No name match but only one pending request → resume it
      if (!regRequest && existingRequests.length === 1) {
        regRequest = await RegistrationRequest.findById(existingRequests[0]._id);
      }
    }

    // 3. Still not found → create fresh request
    if (!regRequest) {
      regRequest = new RegistrationRequest({
        number: cleanNumber,
        status: 'in_progress',
        is_approved: false,
        current_step: 1
      });
    }
  }

  return { regRequest, cleanNumber };
};

// Format Registration Request for Response (Structured with step1, step2, step3, step4, step5)
const formatRegistrationResponse = (reg) => {
  const r = reg.toObject ? reg.toObject() : { ...reg };

  const s1 = r.step1 || {};
  const s2 = Array.isArray(r.step2) ? r.step2 : [];
  const s3 = r.step3 || {};
  const s4 = r.step4 || {};
  const s5 = r.step5 || r.documents || {};

  const step1Data = {
    first_name: sanitizeVal(r.first_name || s1.first_name || ''),
    middle_name: sanitizeVal(r.middle_name || s1.middle_name || ''),
    last_name: sanitizeVal(r.last_name || s1.last_name || ''),
    number: r.number || s1.number || '',
    gender: s1.gender || r.gender || '',
    blood_group: sanitizeVal(s1.blood_group || r.blood_group || ''),
    dob: s1.dob || r.dob,
    marital_status: sanitizeVal(s1.marital_status || r.marital_status || ''),
    patti_para_pargana: sanitizeVal(s1.patti_para_pargana || r.patti_para_pargana || ''),
    peta_jati: sanitizeVal(s1.peta_jati || r.peta_jati || ''),
    profile_image: s1.profile_image || r.profile_image || '',
    ...filterByAllowedKeys(s1, STEP1_KEYS)
  };

  const step3Data = {
    country_id: r.country_id || s3.country_id || '',
    country: r.country || s3.country || '',
    state_id: r.state_id || s3.state_id || '',
    state: s3.state || r.state || '',
    district_id: r.district_id || s3.district_id || '',
    district: s3.district || r.district || '',
    taluka_id: r.taluka_id || s3.taluka_id || '',
    taluka: s3.taluka || r.taluka || '',
    city_id: r.city_id || s3.city_id || '',
    city: s3.city || r.city || '',
    village_id: r.village_id || s3.village_id || '',
    village: s3.village || r.village || '',
    pincode: r.pincode || s3.pincode || '',
    address: r.address || s3.address || '',
    ...s3
  };

  // Only remove empty/null/undefined keys
  for (const key in step3Data) {
    if (step3Data[key] === '' || step3Data[key] === null || step3Data[key] === undefined) {
      delete step3Data[key];
    }
  }

  const step4Data = {
    ...r.occupation_details,
    ...s4
  };
  if (r.occupation || s4.occupation) step4Data.occupation = r.occupation || s4.occupation;
  
  delete step4Data.occupation_type;

  for (const key in step4Data) {
    if (step4Data[key] === '' || step4Data[key] === null || step4Data[key] === undefined) {
      delete step4Data[key];
    }
  }

  const step5Data = {
    ...r.documents,
    ...s5
  };

  for (const key in step5Data) {
    if (step5Data[key] === '' || step5Data[key] === null || step5Data[key] === undefined) {
      delete step5Data[key];
    }
  }

  const responsePayload = {
    _id: r._id,
    status: r.status,
    is_approved: r.is_approved,
    // Step-wise structure: step1: [{data}], step2: [{data}], step3: [{data}], etc.
    step1: [step1Data],
    step2: s2,
    step3: [step3Data],
    step4: [step4Data],
    step5: [step5Data]
  };

  // Only include rejection or correction reasons if they exist
  if (r.rejection_reason && r.rejection_reason.trim() !== '') {
    responsePayload.rejection_reason = r.rejection_reason;
  }
  
  if (r.correction_remarks && r.correction_remarks.trim() !== '') {
    responsePayload.correction_remarks = r.correction_remarks;
  }

  return responsePayload;
};

/**
 * STEP 1: Personal Information (Captures ALL submitted fields, no system fields in step payload)
 */
const saveStep1 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest, cleanNumber } = await findOrCreateRequest(data, req);

    if (!cleanNumber && (!regRequest || !regRequest.number)) {
      return apiResponse(res, 400, 'Primary phone number is required to start registration');
    }

    const imgUrl = extractSingleUrl(data.profile_image) || extractSingleUrl(data.image) || extractSingleUrl(data.photo) || extractSingleUrl(data.avatar) || (req.file ? `/uploads/${req.file.filename}` : '');
    const cleanGender = normalizeGender(data.gender);

    // Filter incoming data strictly to Step 1 allowed keys only
    const cleanStep1Incoming = filterByAllowedKeys(data, STEP1_KEYS);
    const existingStep1 = filterByAllowedKeys(regRequest.step1 || {}, STEP1_KEYS);

    const step1Payload = {
      ...existingStep1,
      ...cleanStep1Incoming,
      first_name: sanitizeVal(data.first_name || regRequest.first_name || 'Member'),
      middle_name: data.middle_name !== undefined ? sanitizeVal(data.middle_name) : (existingStep1.middle_name || ''),
      last_name: data.last_name !== undefined ? sanitizeVal(data.last_name) : (existingStep1.last_name || ''),
      number: cleanNumber || regRequest.number || '',
      patti_para_pargana: data.patti_para_pargana !== undefined ? sanitizeVal(data.patti_para_pargana) : (existingStep1.patti_para_pargana || ''),
      peta_jati: data.peta_jati !== undefined ? sanitizeVal(data.peta_jati) : (existingStep1.peta_jati || ''),
      gender: cleanGender || existingStep1.gender || '',
      blood_group: data.blood_group !== undefined ? sanitizeVal(data.blood_group) : (existingStep1.blood_group || ''),
      dob: data.dob ? new Date(data.dob) : existingStep1.dob,
      marital_status: data.marital_status !== undefined ? sanitizeVal(data.marital_status) : (existingStep1.marital_status || ''),
      profile_image: imgUrl || existingStep1.profile_image || ''
    };

    regRequest.step1 = step1Payload;
    regRequest.first_name = step1Payload.first_name;
    regRequest.middle_name = step1Payload.middle_name;
    regRequest.last_name = step1Payload.last_name;
    regRequest.patti_para_pargana = step1Payload.patti_para_pargana;
    regRequest.peta_jati = step1Payload.peta_jati;
    regRequest.gender = step1Payload.gender;
    regRequest.blood_group = step1Payload.blood_group;
    regRequest.dob = step1Payload.dob;
    regRequest.marital_status = step1Payload.marital_status;
    regRequest.profile_image = step1Payload.profile_image;
    regRequest.current_step = Math.max(regRequest.current_step || 1, 1);
    regRequest.status = regRequest.status === 'approved' ? 'approved' : 'in_progress';

    await regRequest.save();

    return apiResponse(res, 200, 'Step 1: Personal details saved successfully', {
      registration_id: String(regRequest._id),
      step: 1,
      step1: [step1Payload]
    });
  } catch (error) {
    console.error('Error saving step 1:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 1 details');
  }
};

/**
 * STEP 2: Family Details (Captures ALL family member fields)
 */
const saveStep2 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest } = await findOrCreateRequest(data, req);

    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found. Complete Step 1 first.');
    }

    let rawMembers = data.family_members || data.members || data['family_members[]'] || data['members[]'] || [];
    rawMembers = parseJsonIfNeeded(rawMembers);
    if (typeof rawMembers === 'string') {
      try { 
        rawMembers = JSON.parse(rawMembers); 
      } catch (e) {
        return apiResponse(res, 400, 'Invalid JSON format in family_members. Please ensure all strings are quoted (e.g. "dob": "2001-05-15")');
      }
    }
    const membersList = Array.isArray(rawMembers) ? rawMembers : (rawMembers ? [rawMembers] : []);

    const cleanedMembers = [];
    for (let mem of membersList) {
      let item = parseJsonIfNeeded(mem);
      if (typeof item === 'string') {
        try { 
          item = JSON.parse(item); 
        } catch (e) {
          return apiResponse(res, 400, 'Invalid JSON format in family member object.');
        }
      }
      if (!item || typeof item !== 'object') continue;
      const memName = String(item.name || `${item.first_name || ''} ${item.last_name || ''}` || '').trim();
      if (!memName && !item.first_name) continue;

      const names = memName.split(' ');
      const fName = item.first_name || names[0] || '';
      const lName = item.last_name || (names.length > 1 ? names.slice(1).join(' ') : regRequest.last_name || '');

      let calculatedDob;
      if (item.dob) {
        calculatedDob = new Date(item.dob);
      } else if (item.age) {
        const now = new Date();
        now.setFullYear(now.getFullYear() - Number(item.age));
        calculatedDob = now;
      }

      const cleanedItem = cleanForStep(item);
      
      if (calculatedDob) {
        cleanedItem.dob = calculatedDob.toISOString();
      }
      delete cleanedItem.age;

      if (item.number) cleanedItem.number = item.number;
      if (item.mobile) cleanedItem.mobile = item.mobile;
      if (item.phone) cleanedItem.phone = item.phone;
      
      cleanedMembers.push(cleanedItem);
    }

    regRequest.step2 = cleanedMembers;
    regRequest.current_step = Math.max(regRequest.current_step || 1, 2);
    await regRequest.save();

    return apiResponse(res, 200, 'Step 2: Family details saved successfully', {
      registration_id: String(regRequest._id),
      step: 2,
      step2: cleanedMembers
    });
  } catch (error) {
    console.error('Error saving step 2:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 2 details');
  }
};

/**
 * STEP 3: Address Information (Captures ALL address fields)
 */
const saveStep3 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest } = await findOrCreateRequest(data, req);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found. Complete Step 1 first.');
    }

    const isHexId = (val) => Boolean(val && /^[0-9a-fA-F]{24}$/.test(String(val).trim()));

    // Extract country
    let countryId = data.country_id !== undefined ? String(data.country_id).trim() : (isHexId(data.country) ? String(data.country).trim() : (regRequest.country_id || ''));
    let countryName = (!isHexId(data.country) && data.country !== undefined) ? String(data.country).trim() : (regRequest.country || '');

    // Extract state
    let stateId = data.state_id !== undefined ? String(data.state_id).trim() : (isHexId(data.state) ? String(data.state).trim() : (regRequest.state_id || ''));
    let stateName = (!isHexId(data.state) && data.state !== undefined) ? String(data.state).trim() : (regRequest.state || '');

    // Extract district
    let districtId = data.district_id !== undefined ? String(data.district_id).trim() : (isHexId(data.district) ? String(data.district).trim() : (regRequest.district_id || ''));
    let districtName = (!isHexId(data.district) && data.district !== undefined) ? String(data.district).trim() : (regRequest.district || '');

    // Extract taluka
    let talukaId = data.taluka_id !== undefined ? String(data.taluka_id).trim() : (isHexId(data.taluka) ? String(data.taluka).trim() : (regRequest.taluka_id || ''));
    let talukaName = (!isHexId(data.taluka) && data.taluka !== undefined) ? String(data.taluka).trim() : (regRequest.taluka || '');

    // Extract city
    let cityId = data.city_id !== undefined ? String(data.city_id).trim() : (isHexId(data.city) ? String(data.city).trim() : (regRequest.city_id || ''));
    let cityName = (!isHexId(data.city) && data.city !== undefined) ? String(data.city).trim() : (regRequest.city || '');

    // Extract village (user can pass village_id, village as ID, or village as name)
    let villageId = data.village_id !== undefined ? String(data.village_id).trim() : (isHexId(data.village) ? String(data.village).trim() : (regRequest.village_id || ''));
    let villageName = (!isHexId(data.village) && data.village !== undefined) ? String(data.village).trim() : (regRequest.village || '');

    const address = data.address || data.residential_address || data.complete_address || regRequest.address || '';
    const pincode = data.pincode !== undefined ? String(data.pincode).trim() : (regRequest.pincode || '');

    // Collect IDs for master lookup
    const masterIds = [countryId, stateId, districtId, talukaId, cityId, villageId].filter(Boolean);
    if (masterIds.length > 0) {
      const validHexIds = masterIds.filter(id => isHexId(id));
      const objIds = validHexIds.map(id => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      const idQuery = {
        $or: [
          { _id: { $in: [...validHexIds, ...objIds] } },
          { id: { $in: masterIds } }
        ]
      };

      const [masters, cities, states, countries] = await Promise.all([
        Master.find(idQuery).select('_id id name type').lean(),
        City.find(idQuery).select('_id id name city').lean(),
        State.find(idQuery).select('_id id name state').lean(),
        Country.find(idQuery).select('_id id name country').lean()
      ]);
      
      const getVal = (docs, id, fallbackKey = 'name') => {
        if (!id) return '';
        const doc = docs.find(d => String(d._id) === String(id) || String(d.id) === String(id));
        return doc ? (doc[fallbackKey] || doc.name || '') : '';
      };

      if (countryId) {
        const c = getVal(countries, countryId, 'country') || getVal(countries, countryId, 'name');
        if (c) countryName = c;
      }

      if (stateId) {
        const s = getVal(states, stateId, 'state') || getVal(states, stateId, 'name');
        if (s) stateName = s;
      }

      if (cityId) {
        const ci = getVal(cities, cityId, 'city') || getVal(cities, cityId, 'name');
        if (ci) cityName = ci;
      }

      if (districtId) {
        const d = getVal(masters, districtId, 'name');
        if (d) districtName = d;
      }

      if (talukaId) {
        const t = getVal(masters, talukaId, 'name');
        if (t) talukaName = t;
      }

      if (villageId) {
        const v = getVal(masters, villageId, 'name');
        if (v) villageName = v;
      }
    }
    
    // Cross-tenant fallback lookup if any master name was not resolved from primary DB
    if ((countryId && !countryName) || (stateId && !stateName) || (districtId && !districtName) || (cityId && !cityName) || (villageId && !villageName)) {
      try {
        const fbConn = await getFallbackTenantConnection();
        if (fbConn) {
          const validHexIds = masterIds.filter(id => isHexId(id));
          const objIds = validHexIds.map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch (e) { return null; }
          }).filter(Boolean);
          const fbQuery = {
            $or: [
              { _id: { $in: [...validHexIds, ...objIds] } },
              { id: { $in: masterIds } }
            ]
          };

          const [fbMasters, fbCities, fbStates, fbCountries] = await Promise.all([
            (!districtName || !villageName || !talukaName) ? fbConn.collection('masters').find(fbQuery).toArray() : [],
            (!cityName) ? fbConn.collection('cities').find(fbQuery).toArray() : [],
            (!stateName) ? fbConn.collection('states').find(fbQuery).toArray() : [],
            (!countryName) ? fbConn.collection('countries').find(fbQuery).toArray() : []
          ]);

          const getFbVal = (docs, id, fallbackKey = 'name') => {
            if (!id) return '';
            const doc = docs.find(d => String(d._id) === String(id) || String(d.id) === String(id));
            return doc ? (doc[fallbackKey] || doc.name || '') : '';
          };

          if (countryId && !countryName) countryName = getFbVal(fbCountries, countryId, 'country') || getFbVal(fbCountries, countryId, 'name');
          if (stateId && !stateName) stateName = getFbVal(fbStates, stateId, 'state') || getFbVal(fbStates, stateId, 'name');
          if (cityId && !cityName) cityName = getFbVal(fbCities, cityId, 'city') || getFbVal(fbCities, cityId, 'name');
          if (districtId && !districtName) districtName = getFbVal(fbMasters, districtId, 'name');
          if (talukaId && !talukaName) talukaName = getFbVal(fbMasters, talukaId, 'name');
          if (villageId && !villageName) villageName = getFbVal(fbMasters, villageId, 'name');
        }
      } catch (err) {
        console.error('Fallback tenant lookup error:', err);
      }
    }

    // Fallback: If villageName provided without villageId, try to resolve villageId from Master
    if (!villageId && villageName) {
      try {
        const vDoc = await Master.findOne({
          type: 'village',
          name: { $regex: new RegExp(`^${villageName.trim()}$`, 'i') }
        }).select('_id id name').lean();
        if (vDoc) {
          villageId = String(vDoc._id || vDoc.id);
        }
      } catch (e) {}
    }

    // Fallback: If countryName provided without countryId, try to resolve countryId from Country
    if (!countryId && countryName) {
      try {
        const cDoc = await Country.findOne({
          $or: [
            { name: { $regex: new RegExp(`^${countryName.trim()}$`, 'i') } },
            { country: { $regex: new RegExp(`^${countryName.trim()}$`, 'i') } }
          ]
        }).select('_id id name country').lean();
        if (cDoc) {
          countryId = String(cDoc._id || cDoc.id);
        }
      } catch (e) {}
    }

    const step3Payload = {
      ...cleanForStep(regRequest.step3 || {}),
      ...cleanForStep(data),
      country_id: countryId,
      country: countryName,
      state_id: stateId,
      state: stateName,
      district_id: districtId,
      district: districtName,
      taluka_id: talukaId,
      taluka: talukaName,
      city_id: cityId,
      city: cityName,
      village_id: villageId,
      village: villageName,
      address,
      pincode
    };

    // Remove empty/null/undefined keys from step3Payload
    for (const key of Object.keys(step3Payload)) {
      if (step3Payload[key] === '' || step3Payload[key] === null || step3Payload[key] === undefined) {
        delete step3Payload[key];
      }
    }

    // Retain full location fields in registration document
    regRequest.step3 = step3Payload;
    regRequest.country_id = countryId;
    regRequest.country = countryName;
    regRequest.state_id = stateId;
    regRequest.state = stateName;
    regRequest.district_id = districtId;
    regRequest.district = districtName;
    regRequest.taluka_id = talukaId;
    regRequest.taluka = talukaName;
    regRequest.city_id = cityId;
    regRequest.city = cityName;
    regRequest.village_id = villageId;
    regRequest.village = villageName;
    regRequest.address = address;
    regRequest.pincode = pincode;
    regRequest.current_step = Math.max(regRequest.current_step || 1, 3);

    await regRequest.save();

    // Prepare responsePayload with guaranteed names and all non-empty fields
    const responsePayload = {
      ...(countryId ? { country_id: countryId } : {}),
      country: countryName || '',
      ...(stateId ? { state_id: stateId } : {}),
      state: stateName || '',
      ...(districtId ? { district_id: districtId } : {}),
      district: districtName || '',
      ...(talukaId ? { taluka_id: talukaId } : {}),
      ...(talukaName ? { taluka: talukaName } : {}),
      ...(cityId ? { city_id: cityId } : {}),
      city: cityName || '',
      ...(villageId ? { village_id: villageId } : {}),
      village: villageName || '',
      ...(pincode ? { pincode } : {}),
      ...(address ? { address } : {})
    };

    return apiResponse(res, 200, 'Step 3: Address details saved successfully', {
      registration_id: String(regRequest._id),
      step: 3,
      step3: [responsePayload]
    });
  } catch (error) {
    console.error('Error saving step 3:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 3 details');
  }
};

/**
 * STEP 4: Occupation (Captures ALL occupation & business details)
 */
const saveStep4 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest } = await findOrCreateRequest(data, req);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found. Complete Step 1 first.');
    }

    const occType = data.occupation || data.occupation_type || regRequest.occupation || '';
    const step4Payload = {
      ...cleanForStep(regRequest.step4 || {}),
      ...cleanForStep(regRequest.occupation_details || {}),
      ...cleanForStep(data)
    };

    if (occType) {
      step4Payload.occupation = occType;
      step4Payload.occupation_type = occType;
    }

    // Only return fields that have actual values
    for (const key in step4Payload) {
      if (step4Payload[key] === '' || step4Payload[key] === null || step4Payload[key] === undefined) {
        delete step4Payload[key];
      }
    }

    regRequest.step4 = step4Payload;
    if (step4Payload.occupation) {
      regRequest.occupation = step4Payload.occupation;
      regRequest.occupation_type = step4Payload.occupation;
    }
    regRequest.occupation_details = { ...step4Payload };
    regRequest.current_step = Math.max(regRequest.current_step || 1, 4);

    await regRequest.save();

    const responsePayload = { ...step4Payload };
    delete responsePayload.occupation_type;

    return apiResponse(res, 200, 'Step 4: Occupation details saved successfully', {
      registration_id: String(regRequest._id),
      step: 4,
      step4: [responsePayload]
    });
  } catch (error) {
    console.error('Error saving step 4:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 4 details');
  }
};

/**
 * STEP 5: Documents (Captures ALL documents & file uploads)
 */
const saveStep5 = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest } = await findOrCreateRequest(data, req);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found. Complete Step 1 first.');
    }

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        const url = `/uploads/${f.filename}`;
        if (f.fieldname === 'aadhaar_card') data.aadhaar_card = url;
        if (f.fieldname === 'pan_card') data.pan_card = url;
        if (f.fieldname === 'voter_id') data.voter_id = url;
        if (f.fieldname === 'driving_license') data.driving_license = url;
        if (f.fieldname === 'passport') data.passport = url;
      });
    }

    const step5Payload = {
      ...cleanForStep(regRequest.step5 || {}),
      ...cleanForStep(regRequest.documents || {}),
      ...cleanForStep(data),
      aadhaar_card: extractSingleUrl(data.aadhaar_card) || data.aadhaar_number || regRequest.documents?.aadhaar_card || '',
      pan_card: extractSingleUrl(data.pan_card) || data.pan_number || regRequest.documents?.pan_card || '',
      voter_id: extractSingleUrl(data.voter_id) || data.voter_id_number || regRequest.documents?.voter_id || '',
      driving_license: extractSingleUrl(data.driving_license) || regRequest.documents?.driving_license || '',
      passport: extractSingleUrl(data.passport) || data.passport_number || extractSingleUrl(data.document) || extractSingleUrl(data.file) || regRequest.documents?.passport || ''
    };

    for (const key in step5Payload) {
      if (step5Payload[key] === '' || step5Payload[key] === null || step5Payload[key] === undefined) {
        delete step5Payload[key];
      }
    }

    regRequest.step5 = step5Payload;
    regRequest.documents = step5Payload;
    regRequest.current_step = Math.max(regRequest.current_step || 1, 5);

    await regRequest.save();

    return apiResponse(res, 200, 'Step 5: Documents saved successfully', {
      registration_id: String(regRequest._id),
      step: 5,
      step5: [step5Payload]
    });
  } catch (error) {
    console.error('Error saving step 5:', error);
    return apiResponse(res, 500, error.message || 'Error saving Step 5 documents');
  }
};

/**
 * STEP 6: Review Summary
 */
const getReviewSummary = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest } = await findOrCreateRequest(data, req);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration not found. Provide valid ID or number.');
    }

    return apiResponse(res, 200, 'Review summary fetched successfully', {
      registration_id: regRequest._id,
      ...formatRegistrationResponse(regRequest),
      is_completed_5_steps: (regRequest.current_step || 1) >= 5
    });
  } catch (error) {
    console.error('Error fetching review summary:', error);
    return apiResponse(res, 500, error.message || 'Error fetching review summary');
  }
};

/**
 * STEP 7 / Submit for Review
 */
const submitForReview = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest } = await findOrCreateRequest(data, req);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration not found. Provide valid ID or number.');
    }

    regRequest.current_step = 6;
    regRequest.status = 'pending_review';
    regRequest.is_approved = false;
    await regRequest.save();

    return apiResponse(res, 200, 'Your membership application has been submitted for review successfully', {
      registration_id: regRequest._id,
      user_id: regRequest._id,
      status: regRequest.status,
      is_approved: regRequest.is_approved,
      ...formatRegistrationResponse(regRequest)
    });
  } catch (error) {
    console.error('Error submitting for review:', error);
    return apiResponse(res, 500, error.message || 'Error submitting application');
  }
};

/**
 * Complete Full Registration in single call
 */
const completeFullRegistration = async (req, res) => {
  try {
    const data = parseRequestBody(req);
    const { regRequest, cleanNumber } = await findOrCreateRequest(data, req);
    if (!cleanNumber) {
      return apiResponse(res, 400, 'Primary phone number is required');
    }

    const imgUrl = data.profile_image || data.image || data.photo || data.avatar || (req.file ? `/uploads/${req.file.filename}` : '');

    const step1Data = {
      ...data,
      first_name: data.first_name || 'Member',
      middle_name: data.middle_name || '',
      last_name: data.last_name || '',
      number: cleanNumber,
      patti_para_pargana: data.patti_para_pargana || '',
      peta_jati: data.peta_jati || '',
      gender: normalizeGender(data.gender),
      blood_group: data.blood_group || '',
      dob: data.dob ? new Date(data.dob) : undefined,
      marital_status: data.marital_status || '',
      profile_image: imgUrl || ''
    };

    let rawMembers = data.family_members || data.members || [];
    rawMembers = parseJsonIfNeeded(rawMembers);
    const cleanedMembers = [];
    if (Array.isArray(rawMembers)) {
      for (const mem of rawMembers) {
        const item = parseJsonIfNeeded(mem);
        if (!item) continue;
        const memName = (item.name || `${item.first_name || ''} ${item.last_name || ''}`).trim();
        if (!memName && !item.first_name) continue;
        cleanedMembers.push({
          ...item,
          first_name: item.first_name || memName.split(' ')[0] || '',
          middle_name: item.middle_name || '',
          last_name: item.last_name || (memName.split(' ').slice(1).join(' ')) || '',
          name: memName,
          relation: item.relation || 'Other',
          mobile: item.mobile || item.number || cleanNumber,
          gender: normalizeGender(item.gender),
          dob: item.dob ? new Date(item.dob) : undefined,
          age: item.age || ''
        });
      }
    }

    const isHexId = (val) => Boolean(val && /^[0-9a-fA-F]{24}$/.test(String(val).trim()));

    const villageId = data.village_id || (isHexId(data.village) ? data.village : '');
    const villageName = (!isHexId(data.village) && data.village) ? data.village : '';
    const countryId = data.country_id || (isHexId(data.country) ? data.country : '');
    const countryName = (!isHexId(data.country) && data.country) ? data.country : '';

    const step3Data = {
      ...data,
      country_id: countryId,
      country: countryName,
      state_id: data.state_id || (isHexId(data.state) ? data.state : ''),
      state: (!isHexId(data.state) && data.state) ? data.state : '',
      district_id: data.district_id || (isHexId(data.district) ? data.district : ''),
      district: (!isHexId(data.district) && data.district) ? data.district : '',
      taluka_id: data.taluka_id || (isHexId(data.taluka) ? data.taluka : ''),
      taluka: (!isHexId(data.taluka) && data.taluka) ? data.taluka : '',
      city_id: data.city_id || (isHexId(data.city) ? data.city : ''),
      city: (!isHexId(data.city) && data.city) ? data.city : '',
      village_id: villageId,
      village: villageName,
      address: data.address || '',
      pincode: data.pincode ? String(data.pincode).trim() : ''
    };

    const occType = data.occupation || data.occupation_type || '';
    const step4Data = {
      ...data,
      occupation: occType,
      occupation_type: occType,
      business_name: data.business_name || '',
      business_type: data.business_type || '',
      business_address: data.business_address || '',
      business_mobile: data.business_mobile || '',
      business_email: data.business_email || '',
      gst_number: data.gst_number || '',
      website: data.website || ''
    };

    const step5Data = {
      ...data,
      aadhaar_card: data.aadhaar_card || '',
      pan_card: data.pan_card || '',
      voter_id: data.voter_id || '',
      driving_license: data.driving_license || '',
      passport: data.passport || ''
    };

    regRequest.step1 = step1Data;
    regRequest.step2 = cleanedMembers;
    regRequest.step3 = step3Data;
    regRequest.step4 = step4Data;
    regRequest.step5 = step5Data;

    regRequest.first_name = step1Data.first_name;
    regRequest.middle_name = step1Data.middle_name;
    regRequest.last_name = step1Data.last_name;
    regRequest.patti_para_pargana = step1Data.patti_para_pargana;
    regRequest.peta_jati = step1Data.peta_jati;
    regRequest.gender = step1Data.gender;
    regRequest.blood_group = step1Data.blood_group;
    regRequest.dob = step1Data.dob;
    regRequest.marital_status = step1Data.marital_status;
    regRequest.profile_image = step1Data.profile_image;

    regRequest.country_id = step3Data.country_id;
    regRequest.country = step3Data.country;
    regRequest.state_id = step3Data.state_id;
    regRequest.district_id = step3Data.district_id;
    regRequest.taluka_id = step3Data.taluka_id;
    regRequest.city_id = step3Data.city_id;
    regRequest.village_id = step3Data.village_id;
    regRequest.village = step3Data.village;
    regRequest.address = step3Data.address;
    regRequest.pincode = step3Data.pincode;

    regRequest.occupation = occType;
    regRequest.occupation_type = occType;
    regRequest.occupation_details = step4Data;
    regRequest.documents = step5Data;

    regRequest.current_step = 6;
    regRequest.status = 'pending_review';
    regRequest.is_approved = false;

    await regRequest.save();

    return apiResponse(res, 200, 'Registration completed and submitted for review', {
      registration_id: regRequest._id,
      user_id: regRequest._id,
      status: regRequest.status,
      ...formatRegistrationResponse(regRequest)
    });
  } catch (error) {
    console.error('Error in complete full registration:', error);
    return apiResponse(res, 500, error.message || 'Error completing registration');
  }
};

/**
 * ADMIN: Get list of registration requests with step-wise response format
 */
const getRegistrationsList = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', status = '', step = '' } = req.query;
    const query = {};

    if (status) {
      if (status === 'active' || status === 'approved') {
        query.is_approved = true;
      } else if (status === 'pending' || status === 'pending_review') {
        query.status = 'pending_review';
      } else {
        query.status = status;
      }
    }

    if (step) {
      query.current_step = Number(step);
    }

    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      query.$or = [
        { first_name: regex },
        { middle_name: regex },
        { last_name: regex },
        { number: regex },
        { village: regex },
        { patti_para_pargana: regex }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await RegistrationRequest.countDocuments(query);
    const requests = await RegistrationRequest.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formattedList = requests.map(formatRegistrationResponse);

    return apiResponse(res, 200, 'Registrations fetched successfully', {
      registrations: formattedList,
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
 * ADMIN: Get single registration request with step-wise breakdown
 */
const getRegistrationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    let regRequest = null;
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      regRequest = await RegistrationRequest.findById(id).lean();
    }
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found');
    }

    const formatted = formatRegistrationResponse(regRequest);

    return apiResponse(res, 200, 'Registration details fetched successfully', formatted);
  } catch (error) {
    console.error('Error fetching registration details:', error);
    return apiResponse(res, 500, error.message || 'Error fetching registration details');
  }
};

/**
 * ADMIN: Approve registration -> Converts & Inserts/Updates into primary USER table in proper user format
 */
const approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const regRequest = await RegistrationRequest.findById(id);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found');
    }

    const cleanNumber = String(regRequest.number || '').trim().replace(/\D/g, '').slice(-10);
    if (!cleanNumber) {
      return apiResponse(res, 400, 'Registration has no valid phone number to migrate');
    }

    // Block approval if all 5 steps are not complete
    if ((regRequest.current_step || 1) < 5) {
      return apiResponse(res, 400, `Cannot approve: Only ${regRequest.current_step || 1} of 5 steps completed. All 5 steps must be filled before approval.`);
    }

    // Check if User already exists for this number or create fresh Head User
    let headUser = await User.findOne({
      $or: [
        { number: cleanNumber },
        { number: `+91${cleanNumber}` },
        { number: `91${cleanNumber}` }
      ]
    });

    // Find default User role if any
    let defaultRole = await Role.findOne({ name: { $regex: /user|member/i } }).select('_id').lean();
    if (!defaultRole) {
      defaultRole = await Role.findOne({}).select('_id').lean();
    }

    const nextMemberId = headUser ? headUser.member_id : await getNextMemberId();

    let isNewHead = false;
    if (!headUser) {
      isNewHead = true;
      headUser = new User({
        member_id: nextMemberId,
        number: cleanNumber,
        familyHead: true,
        relation: 'Self',
        role_id: defaultRole ? defaultRole._id : undefined
      });
    } else {
      headUser.familyHead = true;
      headUser.relation = 'Self';
      headUser.parent_member_id = null;
      headUser.family_head = { id: null, name: '' };
      if (!headUser.role_id && defaultRole) {
        headUser.role_id = defaultRole._id;
      }
    }

    // Populate head User fields from step-wise registration data
    const s1 = regRequest.step1 || {};
    const s3 = regRequest.step3 || {};
    const s4 = regRequest.step4 || {};
    const s5 = regRequest.step5 || {};

    headUser.first_name = regRequest.first_name || s1.first_name || 'Member';
    headUser.middle_name = regRequest.middle_name || s1.middle_name || '';
    headUser.last_name = regRequest.last_name || s1.last_name || '';
    headUser.father_husband_name = regRequest.father_husband_name || s1.father_husband_name || '';
    headUser.patti_para_pargana = regRequest.patti_para_pargana || s1.patti_para_pargana || '';
    headUser.peta_jati = regRequest.peta_jati || s1.peta_jati || '';
    headUser.gender = regRequest.gender || s1.gender || '';
    headUser.blood_group = regRequest.blood_group || s1.blood_group || '';
    if (regRequest.dob || s1.dob) headUser.dob = new Date(regRequest.dob || s1.dob);
    if (regRequest.anniversary || s1.anniversary) headUser.anniversary = new Date(regRequest.anniversary || s1.anniversary);
    headUser.marital_status = regRequest.marital_status || s1.marital_status || '';
    if (regRequest.email || s1.email) headUser.email = (regRequest.email || s1.email).toLowerCase().trim();

    const headImg = regRequest.profile_image || s1.profile_image || '';
    if (headImg) {
      headUser.profile_image = headImg;
      headUser.image = headImg;
    }

    headUser.country_id = regRequest.country_id || s3.country_id || '';
    headUser.country = regRequest.country || s3.country || '';
    headUser.state_id = regRequest.state_id || s3.state_id || '';
    headUser.district_id = regRequest.district_id || s3.district_id || '';
    headUser.taluka_id = regRequest.taluka_id || s3.taluka_id || '';
    headUser.city_id = regRequest.city_id || s3.city_id || '';
    headUser.village_id = regRequest.village_id || s3.village_id || '';
    headUser.village = regRequest.village || s3.village || '';
    headUser.address = regRequest.address || s3.address || '';
    headUser.pincode = regRequest.pincode || s3.pincode || '';

    const occType = regRequest.occupation || s4.occupation || s4.occupation_type || '';
    headUser.occupation = occType;
    headUser.occupation_type = occType;
    headUser.occupation_details = {
      ...regRequest.occupation_details,
      ...s4,
      business_name: s4.business_name || regRequest.occupation_details?.business_name || '',
      business_type: s4.business_type || regRequest.occupation_details?.business_type || '',
      business_address: s4.business_address || regRequest.occupation_details?.business_address || '',
      business_mobile: s4.business_mobile || regRequest.occupation_details?.business_mobile || '',
      business_email: s4.business_email || regRequest.occupation_details?.business_email || '',
      designation: s4.designation || regRequest.occupation_details?.designation || '',
      income_range: s4.income_range || regRequest.occupation_details?.income_range || '',
      gst_number: s4.gst_number || regRequest.occupation_details?.gst_number || '',
      website: s4.website || regRequest.occupation_details?.website || ''
    };

    headUser.documents = {
      ...regRequest.documents,
      ...s5,
      aadhaar_card: s5.aadhaar_card || regRequest.documents?.aadhaar_card || '',
      pan_card: s5.pan_card || regRequest.documents?.pan_card || '',
      voter_id: s5.voter_id || regRequest.documents?.voter_id || '',
      driving_license: s5.driving_license || regRequest.documents?.driving_license || '',
      passport: s5.passport || regRequest.documents?.passport || ''
    };

    headUser.status = 1; // Active member in User table
    headUser.registration_status = 'approved';
    headUser.registration_step = 6;
    headUser.rejection_reason = '';
    headUser.correction_remarks = '';

    await headUser.save();

    // Sync step2 family members into User collection under this head
    const familyMembersList = Array.isArray(regRequest.step2) ? regRequest.step2 : [];
    await User.deleteMany({
      $or: [
        { parent_member_id: headUser.member_id, relation: { $ne: 'Self' } },
        { 'family_head.id': headUser._id, relation: { $ne: 'Self' } }
      ]
    });

    if (familyMembersList.length > 0) {
      for (const mem of familyMembersList) {
        if (!mem) continue;
        const memName = (mem.name || `${mem.first_name || ''} ${mem.last_name || ''}`).trim();
        if (!memName && !mem.first_name) continue;

        const memNextId = await getNextMemberId();
        const names = memName.split(' ');
        const fName = mem.first_name || names[0] || '';
        const lName = mem.last_name || (names.length > 1 ? names.slice(1).join(' ') : headUser.last_name || '');

        let calculatedDob = mem.dob ? new Date(mem.dob) : undefined;
        if (!calculatedDob && mem.age) {
          const now = new Date();
          now.setFullYear(now.getFullYear() - Number(mem.age));
          calculatedDob = now;
        }

        await new User({
          ...mem,
          member_id: memNextId,
          parent_member_id: headUser.member_id,
          first_name: fName,
          middle_name: mem.middle_name || headUser.first_name || '',
          last_name: lName,
          number: mem.mobile || mem.number || headUser.number,
          relation: mem.relation || 'Other',
          dob: calculatedDob,
          gender: mem.gender || '',
          marital_status: mem.marital_status || '',
          country_id: headUser.country_id,
          country: headUser.country || '',
          state_id: headUser.state_id,
          district_id: headUser.district_id,
          taluka_id: headUser.taluka_id,
          city_id: headUser.city_id,
          village_id: headUser.village_id,
          village: headUser.village,
          address: headUser.address,
          pincode: headUser.pincode,
          family_head: { id: headUser._id, name: `${headUser.first_name || ''} ${headUser.last_name || ''}`.trim() },
          familyHead: false,
          role_id: defaultRole ? defaultRole._id : undefined,
          status: 1,
          registration_status: 'approved'
        }).save();
      }
    }

    // Update RegistrationRequest state
    regRequest.status = 'approved';
    regRequest.is_approved = true;
    regRequest.user_id = headUser._id;
    regRequest.member_id = headUser.member_id;
    regRequest.approved_at = new Date();
    regRequest.approved_by = req.user?._id || null;
    regRequest.rejection_reason = '';
    regRequest.correction_remarks = '';
    await regRequest.save();

    return apiResponse(res, 200, 'Registration approved successfully! Transferred to active User directory.', {
      registration_id: regRequest._id,
      user_id: headUser._id,
      member_id: headUser.member_id,
      is_approved: true,
      status: 'approved'
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    return apiResponse(res, 500, error.message || 'Error approving registration');
  }
};

/**
 * ADMIN: Reject registration request
 */
const rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, remarks } = req.body;
    const regRequest = await RegistrationRequest.findById(id);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found');
    }

    const rejReason = reason || remarks || 'Application rejected by Admin';
    regRequest.status = 'rejected';
    regRequest.is_approved = false;
    regRequest.rejection_reason = rejReason;
    await regRequest.save();

    if (regRequest.user_id) {
      await User.findByIdAndUpdate(regRequest.user_id, {
        status: 0,
        registration_status: 'rejected',
        rejection_reason: rejReason
      });
      await User.updateMany(
        { parent_member_id: regRequest.member_id },
        { status: 0, registration_status: 'rejected', rejection_reason: rejReason }
      );
    }

    return apiResponse(res, 200, 'Registration marked as rejected', {
      registration_id: regRequest._id,
      status: 'rejected',
      rejection_reason: rejReason
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    return apiResponse(res, 500, error.message || 'Error rejecting registration');
  }
};

/**
 * ADMIN: Request correction from user
 */
const requestCorrectionRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks, fields_to_correct, reason } = req.body;
    const regRequest = await RegistrationRequest.findById(id);
    if (!regRequest) {
      return apiResponse(res, 404, 'Registration request not found');
    }

    const note = remarks || reason || 'Please correct your details';
    regRequest.status = 'needs_correction';
    regRequest.is_approved = false;
    regRequest.correction_remarks = note;
    regRequest.fields_to_correct = fields_to_correct || [];
    await regRequest.save();

    if (regRequest.user_id) {
      await User.findByIdAndUpdate(regRequest.user_id, {
        registration_status: 'needs_correction',
        correction_remarks: note,
        fields_to_correct: fields_to_correct || []
      });
    }

    return apiResponse(res, 200, 'Correction requested successfully. User can update required fields.', {
      registration_id: regRequest._id,
      status: 'needs_correction',
      correction_remarks: note
    });
  } catch (error) {
    console.error('Error requesting correction:', error);
    return apiResponse(res, 500, error.message || 'Error requesting correction');
  }
};

/**
 * ADMIN: Unified Status Update API
 * Accepts status ('approved' | 'rejected' | 'needs_correction') and reason
 */
const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, reason } = req.body;

    if (!status) {
      return apiResponse(res, 400, 'Status is required');
    }

    status = status.toLowerCase().trim();

    if (status === 'approved' || status === 'approval' || status === 'approve') {
      return approveRegistration(req, res);
    } 
    
    if (status === 'rejected' || status === 'reject') {
      if (!req.body.reason) req.body.reason = reason || 'Application Rejected';
      return rejectRegistration(req, res);
    } 
    
    if (status === 'needs_correction' || status === 'correction') {
      if (!req.body.remarks) req.body.remarks = reason || 'Please correct your details';
      return requestCorrectionRegistration(req, res);
    }

    return apiResponse(res, 400, 'Invalid status provided. Use: approved, rejected, or needs_correction');

  } catch (error) {
    console.error('Error updating registration status:', error);
    return apiResponse(res, 500, error.message || 'Error updating status');
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
  requestCorrectionRegistration,
  updateRegistrationStatus
};
