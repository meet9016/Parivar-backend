const fs = require('fs');
const path = require('path');
const User = require('../models/userModels');
const mongoose = require('mongoose');
const { apiResponse, publicUrl } = require('../utils/apiResponse');
const { getRolePermissions } = require('../middleware/auth');
const familyUtil = require('../utils/familyHelper');
const jwt = require('jsonwebtoken');
const { deleteFileFromExternalService } = require('../utils/fileUpload');
const queryHelper = require('../utils/queryHelper');
const { prepareFamilyFields, fullName } = require('../utils/familyHelper');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { renderVafatCardHtml } = require('../templates/vafatCardTemplateService');
const { generatePdfFromHtml, generateImageFromHtml, synchronizedGeneratePdf } = require('../services/pdfService');

function resolveBaseUrl(req) {
  let base = '';
  if (process.env.BASE_URL) base = process.env.BASE_URL;
  else if (process.env.APP_URL) base = process.env.APP_URL;
  else if (req) {
    const protocol = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http';
    const host = req?.headers?.['x-forwarded-host'] || (typeof req?.get === 'function' ? req.get('host') : '') || 'localhost:5000';
    base = `${protocol}://${host}`;
  } else {
    base = 'http://localhost:5000';
  }
  return base.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

function buildDeathDownloadUrl(userId, req, format = 'png') {
  const baseUrl = resolveBaseUrl(req);
  const token = req?.query?.token || '';
  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';

  const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host') || '';
  const referer = req?.headers?.['referer'] || '';
  const isApiApi = (req?.originalUrl && req.originalUrl.includes('/api/api')) ||
                    host.includes('parivar.me') ||
                    referer.includes('parivar.me');

  const prefix = isApiApi ? '/api/api' : '/api';
  return `${baseUrl}${prefix}/users/death/${userId}/download?format=${format}${tokenQuery}`;
}

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfamilykey';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '365d';

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  return req.body.image || fallback || '';
};

const sanitizeUser = (user) => {
  if (!user) return user;
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  return data;
};

const register = async (req, res) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      email,
      password,
      number,
      gender,
      dob,
      anniversary,
      blood_group,
      relation,
      is_committee,
      committee_role,
      profile_image,
      country_id,
      state_id,
      city_id,
      village,
      village_id,
      address,
      image,
      family_head_id,
      familyHead
    } = req.body;

    const isDeceasedMember = req.body.is_deceased === true || req.body.is_deceased === 'true';
    if (!first_name || (!number && !isDeceasedMember)) {
      return res.status(400).json({ message: 'First name and number are required' });
    }

    if (email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }
    }

    const owner = req.user ? req.user : {};
    const familyData = await prepareFamilyFields({
      relation,
      family_head_id: req.body.family_head_id,
      status: req.body.status,
      familyHead,
      is_deceased: req.body.is_deceased === true || req.body.is_deceased === 'true'
    });

    const latestUser = await User.findOne({ member_id: /^\d+$/ })
      .sort({ createdAt: -1, _id: -1 })
      .select('member_id')
      .lean();

    let nextMemberId = '1';
    if (latestUser && !isNaN(Number(latestUser.member_id))) {
      nextMemberId = String(Number(latestUser.member_id) + 1);
    } else {
      const count = await User.countDocuments();
      nextMemberId = String(count + 1);
    }

    const newUser = new User({
      member_id: nextMemberId,
      first_name,
      middle_name,
      last_name,

      email: email ? email.toLowerCase() : '',
      password: password || '12345',
      number,
      gender,
      dob,
      anniversary,
      blood_group,
      relation: familyData.relation,
      is_committee,
      committee_role,
      profile_image,
      country_id,
      state_id,
      city_id,
      village: village || village_id || '',
      village_id: village_id || '',
      address,
      image: image || '',
      is_deceased: req.body.is_deceased === true || req.body.is_deceased === 'true',
      death_date: req.body.death_date ? new Date(req.body.death_date) : null,
      death_time: req.body.death_time || '',
      death_place: req.body.death_place || '',
      death_note: req.body.death_note || '',
      janaza_date: req.body.janaza_date ? new Date(req.body.janaza_date) : null,
      janaza_time: req.body.janaza_time || '',
      janaza_place: req.body.janaza_place || '',
      kabrastan: req.body.kabrastan || '',
      ziyarat_date: req.body.ziyarat_date ? new Date(req.body.ziyarat_date) : (req.body.besnu_date ? new Date(req.body.besnu_date) : null),
      ziyarat_time: req.body.ziyarat_time || req.body.besnu_time || '',
      ziyarat_place: req.body.ziyarat_place || req.body.besnu_place || '',
      besnu_date: req.body.ziyarat_date ? new Date(req.body.ziyarat_date) : (req.body.besnu_date ? new Date(req.body.besnu_date) : null),
      besnu_time: req.body.ziyarat_time || req.body.besnu_time || '',
      besnu_place: req.body.ziyarat_place || req.body.besnu_place || '',
      family_head: familyData.family_head,
      familyHead: familyHead === true || familyHead === 'true',
      status: familyData.status,
    });
    const Role = require('../models/roleModel');
    const defaultRole = await Role.findOne({ name: 'UserRole' });
    if (defaultRole) {
      newUser.role_id = defaultRole._id;
    }

    await newUser.save();
    if (familyData.relation === 'Self' || newUser.familyHead) {
      newUser.family_head = {
        id: newUser._id,
        name: fullName(newUser)
      };
      if (req.body.status === undefined) {
        newUser.status = 1;
      }
      await newUser.save();
    }
    let membersList = req.body.members;
    if (typeof membersList === 'string') {
      try {
        membersList = JSON.parse(membersList);
      } catch (e) {
        membersList = [];
      }
    }
    const createdMembers = [];
    if (Array.isArray(membersList) && membersList.length > 0) {
      let currentMemberId = Number(newUser.member_id || nextMemberId || 0);
      for (const m of membersList) {
        if (!m.first_name || !m.first_name.trim()) continue;
        currentMemberId += 1;
        const childUser = new User({
          member_id: String(currentMemberId),
          first_name: m.first_name.trim(),
          middle_name: m.middle_name ? m.middle_name.trim() : (newUser.first_name || ''),
          last_name: m.last_name ? m.last_name.trim() : (newUser.last_name || ''),
          email: m.email ? m.email.toLowerCase().trim() : '',
          password: m.password || '12345',
          number: m.number ? m.number.trim() : (newUser.number || ''),
          gender: m.gender || 'Male',
          dob: m.dob || null,
          anniversary: m.anniversary || null,
          blood_group: m.blood_group || '',
          relation: m.relation || 'Other',
          country_id: newUser.country_id,
          state_id: newUser.state_id,
          city_id: newUser.city_id,
          village: newUser.village,
          village_id: newUser.village_id,
          address: newUser.address,
          image: m.image || m.profile_image || '',
          family_head: {
            id: newUser._id,
            name: fullName(newUser)
          },
          familyHead: false,
          status: m.status !== undefined ? Number(m.status) : (newUser.status !== undefined ? Number(newUser.status) : 1),
          role_id: defaultRole ? defaultRole._id : undefined
        });
        await childUser.save();
        createdMembers.push(sanitizeUser(childUser));
      }
    }
    const registeredData = sanitizeUser(newUser);
    registeredData.image = publicUrl(req, registeredData.image || registeredData.profile_image || '');
    if (createdMembers.length > 0) {
      registeredData.members = createdMembers;
    }
    res.status(201).json({
      message: 'User registered successfully',
      data: registeredData
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

// Login user and return JWT
// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) {
//       return res.status(400).json({ message: 'Email and password are required' });
//     }
//     const user = await User.findOne({ email: email.toLowerCase() });
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid email or password' });
//     }
//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//       return res.status(401).json({ message: 'Invalid email or password' });
//     }
//     // Generate JWT token
//     const token = jwt.sign(
//       { id: user._id },
//       JWT_SECRET,
//       { expiresIn: JWT_EXPIRES_IN }
//     );
//     res.status(200).json({
//       message: 'Login successful',
//       token,
//       data: sanitizeUser(user)
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Error logging in', error: error.message });
//   }
// };
// Get authenticated user profile

const getProfile = async (req, res) => {
  try {
    // req.user is populated by the protect middleware
    const profileData = sanitizeUser(req.user);
    profileData.image = publicUrl(req, profileData.image || profileData.profile_image || '');

    res.status(200).json({
      message: 'Profile retrieved successfully',
      data: profileData
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving profile', error: error.message });
  }
};

const mongooseQueryForUser = (id) => {
  if (!id || id === 'undefined' || id === 'null') {
    return { _id: null };
  }
  if (mongoose.isValidObjectId(id)) {
    return { _id: id };
  }
  return { $or: [{ member_id: String(id) }, { _id: id }] };
};

const getUsers = async (req, res) => {
  try {
    console.log("getUsers Query params:", req.query);
    const birthday = 'birthday' in req.query;
    const anniversary = 'anniversary' in req.query;
    const death = 'death' in req.query || 'deaths' in req.query || 'deceased' in req.query || 'obituary' in req.query;

    const query = {};
    const requestPermissions = getRolePermissions(req.user);
    const canListMembers = requestPermissions.includes('members.list') || requestPermissions.includes('users.manage');
    const canListCommittee = requestPermissions.includes('committee.list') || requestPermissions.includes('committee.manage');

    if (req.query.gender) query.gender = req.query.gender;
    if (req.query.blood_group) query.blood_group = req.query.blood_group;
    if (req.query.is_committee !== undefined) {
      query.is_committee = req.query.is_committee === 'true';
    }
    if (!canListMembers && canListCommittee) {
      query.is_committee = true;
    }
    if (req.query.is_head === 'true' || req.query.heads === 'true') {
      query.relation = 'Self';
    }
    if (req.query.familyHead !== undefined) {
      query.familyHead = req.query.familyHead === 'true';
    }
    if (req.query.family_head_id) {
      const headId = mongooseQueryForUser(req.query.family_head_id)._id;
      if (mongoose.isValidObjectId(headId)) {
        query.$or = [
          { 'family_head.id': new mongoose.Types.ObjectId(headId) },
          { _id: new mongoose.Types.ObjectId(headId) }
        ];
      } else {
        query.$or = [
          { 'family_head.id': headId },
          { _id: headId }
        ];
      }
    }
    if (req.query.family_head_name) {
      query['family_head.name'] = { $regex: req.query.family_head_name, $options: 'i' };
    }
    if (birthday) {
      query.dob = { $exists: true, $ne: null };
      const conditions = [];
      if (req.query.dob_month) {
        conditions.push({
          $and: [
            { $eq: [{ $type: "$dob" }, "date"] },
            { $eq: [{ $month: "$dob" }, Number(req.query.dob_month)] }
          ]
        });
      }
      if (req.query.dob_year) {
        conditions.push({
          $and: [
            { $eq: [{ $type: "$dob" }, "date"] },
            { $eq: [{ $year: "$dob" }, Number(req.query.dob_year)] }
          ]
        });
      }
      if (conditions.length > 0) {
        query.$expr = conditions.length === 1 ? conditions[0] : { $and: conditions };
      }
      if (req.query.dob_start || req.query.dob_end) {
        const range = {};
        if (req.query.dob_start) range.$gte = new Date(req.query.dob_start);
        if (req.query.dob_end) range.$lte = new Date(req.query.dob_end);
        query.dob = { ...query.dob, ...range };
      }
    }

    if (anniversary) {
      query.anniversary = { $exists: true, $ne: null };
    }

    if (death) {
      query.$or = [
        { is_deceased: true },
        { death_date: { $exists: true, $ne: null } }
      ];
      const conditions = [];
      const m = req.query.death_month || req.query.dob_month || req.query.month;
      if (m) {
        conditions.push({
          $and: [
            { $eq: [{ $type: "$death_date" }, "date"] },
            { $eq: [{ $month: "$death_date" }, Number(m)] }
          ]
        });
      }
      const y = req.query.death_year || req.query.dob_year || req.query.year;
      if (y) {
        conditions.push({
          $and: [
            { $eq: [{ $type: "$death_date" }, "date"] },
            { $eq: [{ $year: "$death_date" }, Number(y)] }
          ]
        });
      }
      if (conditions.length > 0) {
        query.$expr = conditions.length === 1 ? conditions[0] : { $and: conditions };
      }
      const sDate = req.query.death_start || req.query.dob_start || req.query.start_date;
      const eDate = req.query.death_end || req.query.dob_end || req.query.end_date;
      if (sDate || eDate) {
        const range = {};
        if (sDate) range.$gte = new Date(sDate);
        if (eDate) range.$lte = new Date(eDate);
        query.death_date = range;
      }
    }

    // Determine if this is the Family Registry listing request (default view in Users.jsx)
    const isFamilyRegistryListing =
      !birthday &&
      !anniversary &&
      !death &&
      req.query.is_committee === undefined &&
      !req.query.family_head_id &&
      req.query.is_head !== 'true' &&
      req.query.heads !== 'true' &&
      req.query.flat !== 'true';

    if (isFamilyRegistryListing) {
      // Family-based pagination:
      // 1. Only count & paginate Family Heads (relation: 'Self' or familyHead: true)
      // 2. Fetch all dependent members under these paginated heads and attach them
      const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchFields = ['first_name', 'middle_name', 'last_name', 'number', 'email', 'village', 'family_head.name'];
      const headCriteria = {
        $or: [
          { familyHead: true },
          { relation: 'Self' }
        ]
      };

      const headClauses = [headCriteria];

      if (req.query.search && String(req.query.search).trim()) {
        const rawSearch = String(req.query.search).trim();
        const tokens = rawSearch.split(/\s+/).filter(Boolean);
        let searchCondition;
        if (tokens.length === 1) {
          const searchRegex = new RegExp(escapeRegExp(tokens[0]), 'i');
          searchCondition = { $or: searchFields.map(field => ({ [field]: searchRegex })) };
        } else {
          const tokenClauses = tokens.map(token => {
            const tokenRegex = new RegExp(escapeRegExp(token), 'i');
            return { $or: searchFields.map(field => ({ [field]: tokenRegex })) };
          });
          searchCondition = { $and: tokenClauses };
        }

        // Search matching non-head members to find their parent head IDs
        const [matchingChildHeadIds, matchingChildParentMemberIds] = await Promise.all([
          User.find({
            ...searchCondition,
            relation: { $ne: 'Self' },
            familyHead: { $ne: true }
          }).distinct('family_head.id'),
          User.find({
            ...searchCondition,
            relation: { $ne: 'Self' },
            familyHead: { $ne: true },
            parent_member_id: { $exists: true, $ne: null, $ne: '' }
          }).distinct('parent_member_id')
        ]);

        const validHeadObjectIds = (matchingChildHeadIds || [])
          .filter(id => id && mongoose.isValidObjectId(id))
          .map(id => new mongoose.Types.ObjectId(id));

        const validParentMemberIds = (matchingChildParentMemberIds || []).filter(Boolean);

        const headSearchOr = [
          searchCondition,
          ...(validHeadObjectIds.length ? [{ _id: { $in: validHeadObjectIds } }] : []),
          ...(validParentMemberIds.length ? [{ member_id: { $in: validParentMemberIds } }] : [])
        ];

        headClauses.push({ $or: headSearchOr });
      }

      // Handle filters
      if (req.query.gender) {
        headClauses.push({ gender: req.query.gender });
      }
      if (req.query.blood_group) {
        headClauses.push({ blood_group: req.query.blood_group });
      }
      if (req.query.village) {
        headClauses.push({ $or: [{ village: req.query.village }, { village_id: req.query.village }] });
      }
      if (req.query.status !== undefined && req.query.status !== '') {
        const sVal = Number(req.query.status);
        if (!isNaN(sVal)) {
          if (sVal === 1) {
            headClauses.push({ $or: [{ status: 1 }, { status: '1' }, { status: { $exists: false } }, { status: null }] });
          } else {
            headClauses.push({ $or: [{ status: 0 }, { status: '0' }] });
          }
        }
      }

      const finalHeadQuery = headClauses.length === 1 ? headClauses[0] : { $and: headClauses };

      const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const requestedLimit = parseInt(req.query.limit, 10);
      const limit = Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 15, 1);

      const totalHeads = await User.countDocuments(finalHeadQuery);
      const totalPages = Math.max(Math.ceil(totalHeads / limit), 1);
      const page = Math.min(requestedPage, totalPages);

      const paginatedHeads = await User.find(finalHeadQuery)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('role_id');

      const headObjectIds = paginatedHeads.map(h => h._id);
      const headIdStrings = paginatedHeads.map(h => String(h._id));
      const headMemberIds = paginatedHeads.map(h => String(h.member_id)).filter(Boolean);

      let childMembers = [];
      if (headObjectIds.length > 0) {
        const childQuery = {
          _id: { $nin: headObjectIds },
          $or: [
            { 'family_head.id': { $in: headObjectIds } },
            { 'family_head.id': { $in: headIdStrings } },
            { parent_member_id: { $in: headMemberIds } }
          ]
        };
        childMembers = await User.find(childQuery)
          .sort({ createdAt: 1, _id: 1 })
          .populate('role_id');
      }

      const formatUserObj = (u) => ({
        id: u.id || String(u._id),
        _id: u._id,
        member_id: u.member_id || '',
        parent_member_id: u.parent_member_id || null,
        first_name: u.first_name,
        middle_name: u.middle_name || '',
        last_name: u.last_name || '',
        name: fullName(u),
        email: u.email || '',
        number: u.number,
        phone: u.number || '',
        gender: u.gender || '',
        dob: u.dob || null,
        anniversary: u.anniversary || null,
        blood_group: u.blood_group || '',
        relation: u.relation || 'Self',
        is_committee: u.is_committee || false,
        committee_role: u.committee_role || '',
        designation: u.designation || '',
        country_id: u.country_id || '',
        state_id: u.state_id || '',
        city_id: u.city_id || '',
        village: u.village || u.village_id || '',
        village_id: u.village_id || '',
        family_head: u.family_head ? {
          id: u.family_head.id ? String(u.family_head.id) : '',
          name: u.family_head.name || ''
        } : null,
        role_id: u.role_id?._id ? String(u.role_id._id) : '',
        role_name: u.role_id?.name || '',
        address: u.address || '',
        status: Number(u.status ?? 1),
        familyHead: u.familyHead || u.relation === 'Self' || false,
        image: publicUrl(req, u.image || u.profile_image || ''),
        profile_image: u.profile_image || '',
        role: u.is_committee ? 'admin' : 'user'
      });

      const formatted = paginatedHeads.map(head => {
        const headIdStr = String(head._id);
        const headMemberIdStr = String(head.member_id || '');
        const matchingChildren = childMembers.filter(m => {
          const mHeadId = String(m.family_head?.id || m.family_head?._id || '');
          const mParentId = String(m.parent_member_id || '');
          return (mHeadId && (mHeadId === headIdStr || mHeadId === headMemberIdStr)) ||
            (mParentId && (mParentId === headMemberIdStr || mParentId === headIdStr));
        });

        const formattedHead = formatUserObj(head);
        formattedHead.childrenCount = matchingChildren.length;
        formattedHead.members = matchingChildren.map(formatUserObj);
        return formattedHead;
      });

      return apiResponse(res, 200, 'Users retrieved successfully', formatted, {
        total: totalHeads,
        page,
        limit,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages
      });
    }

    const { data: users, pagination } = await queryHelper(User, req.query, {
      baseQuery: query,
      searchFields: ['first_name', 'middle_name', 'last_name', 'number', 'email', 'village', 'family_head.name'],
      filterFields: ['gender', 'blood_group', 'is_committee', 'committee_role', 'role_id', 'status', 'familyHead'],
      select: (birthday || anniversary) ? '_id first_name middle_name last_name number dob anniversary' : death ? '_id member_id first_name middle_name last_name number email dob gender village address profile_image image is_deceased death_date death_time death_place death_note janaza_date janaza_time janaza_place kabrastan ziyarat_date ziyarat_time ziyarat_place besnu_date besnu_time besnu_place relation familyHead family_head status' : '-password',
      populate: (birthday || anniversary || death) ? '' : 'role_id',
      defaultSort: { createdAt: -1 },
      lean: false
    });

    if (birthday) {
      const formatted = users.map(u => ({
        id: u.id || String(u._id),
        _id: u._id,
        first_name: u.first_name || '',
        middle_name: u.middle_name || '',
        last_name: u.last_name || '',
        name: fullName(u),
        number: u.number || '',
        dob: u.dob || null,
        anniversary: u.anniversary || null
      }));
      return apiResponse(res, 200, 'Users birthday list retrieved successfully', formatted, pagination);
    }

    if (anniversary) {
      const formatted = users.map(u => ({
        id: u.id || String(u._id),
        _id: u._id,
        first_name: u.first_name || '',
        middle_name: u.middle_name || '',
        last_name: u.last_name || '',
        name: fullName(u),
        number: u.number || '',
        anniversary: u.anniversary || null
      }));
      return apiResponse(res, 200, 'Users birthday list retrieved successfully', formatted, pagination);
    }

    if (death) {
      const today = new Date();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth() + 1;

      const formatted = users.map(u => {
        let isToday = false;
        if (u.death_date) {
          const d = new Date(u.death_date);
          if (!isNaN(d.getTime())) {
            if ((d.getDate() === todayDay && (d.getMonth() + 1) === todayMonth) ||
              (d.getUTCDate() === todayDay && (d.getUTCMonth() + 1) === todayMonth)) {
              isToday = true;
            }
          }
        }

        return {
          id: u.id || String(u._id),
          _id: u._id,
          member_id: u.member_id || '',
          first_name: u.first_name || '',
          middle_name: u.middle_name || '',
          last_name: u.last_name || '',
          name: fullName(u),
          number: u.number || '',
          email: u.email || '',
          dob: u.dob || null,
          gender: u.gender || '',
          village: u.village || '',
          address: u.address || '',
          profile_image: u.profile_image || u.image || '',
          image: u.profile_image || u.image || '',
          is_deceased: Boolean(u.is_deceased ?? true),
          death_date: u.death_date || null,
          death_time: u.death_time || '',
          death_place: u.death_place || '',
          death_note: u.death_note || '',
          janaza_date: u.janaza_date || null,
          janaza_time: u.janaza_time || '',
          janaza_place: u.janaza_place || '',
          kabrastan: u.kabrastan || '',
          ziyarat_date: u.ziyarat_date || u.besnu_date || null,
          ziyarat_time: u.ziyarat_time || u.besnu_time || '',
          ziyarat_place: u.ziyarat_place || u.besnu_place || '',
          besnu_date: u.ziyarat_date || u.besnu_date || null,
          besnu_time: u.ziyarat_time || u.besnu_time || '',
          besnu_place: u.ziyarat_place || u.besnu_place || '',
          is_today: isToday,
          relation: u.relation || '',
          familyHead: Boolean(u.familyHead),
          family_head: u.family_head || null,
          download_url: buildDeathDownloadUrl(u.id || String(u._id), req, 'png'),
          png_url: buildDeathDownloadUrl(u.id || String(u._id), req, 'png'),
          pdf_url: buildDeathDownloadUrl(u.id || String(u._id), req, 'pdf')
        };
      });

      // Sort: Today's death anniversary strictly on top, then by death_date descending
      formatted.sort((a, b) => {
        if (a.is_today && !b.is_today) return -1;
        if (!a.is_today && b.is_today) return 1;
        const dateA = a.death_date ? new Date(a.death_date).getTime() : 0;
        const dateB = b.death_date ? new Date(b.death_date).getTime() : 0;
        return dateB - dateA;
      });

      return apiResponse(res, 200, 'Deceased members list retrieved successfully', formatted, pagination);
    }
    // Map backend user to the fields expected by standard layout or user forms
    const formatted = users.map(u => ({
      id: u.id || String(u._id),
      _id: u._id,
      first_name: u.first_name,
      middle_name: u.middle_name || '',
      last_name: u.last_name || '',
      name: fullName(u),
      email: u.email || '',
      number: u.number,
      gender: u.gender || '',
      dob: u.dob || null,
      anniversary: u.anniversary || null,
      blood_group: u.blood_group || '',
      relation: u.relation || 'Self',
      is_committee: u.is_committee || false,
      committee_role: u.committee_role || '',
      designation: u.designation || '',
      country_id: u.country_id || '',
      state_id: u.state_id || '',
      city_id: u.city_id || '',
      village: u.village || u.village_id || '',
      village_id: u.village_id || '',
      family_head: u.family_head ? {
        id: u.family_head.id ? String(u.family_head.id) : '',
        name: u.family_head.name || ''
      } : null,
      role_id: u.role_id?._id ? String(u.role_id._id) : '',
      role_name: u.role_id?.name || '',
      address: u.address || '',
      status: Number(u.status ?? 1),
      familyHead: u.familyHead || false,
      image: publicUrl(req, u.image || u.profile_image || ''),
      role: u.is_committee ? 'admin' : 'user'
    }));

    return apiResponse(res, 200, 'Users retrieved successfully', formatted, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving users', { error: error.message });
  }
};

const getFamilyMembers = async (req, res) => {
  req.query.family_head_id = req.params.family_head_id;
  return getUsers(req, res);
};

const getFamilyMembersByNumber = async (req, res) => {
  try {
    const { number } = req.params;
    if (!number) return apiResponse(res, 400, 'Number is required');

    const head = await User.findOne({ number, relation: 'Self' });
    let users = [];

    if (head) {
      users = await User.find({
        $or: [
          { 'family_head.id': head._id },
          { 'family_head.id': String(head._id) },
          { _id: head._id }
        ]
      }).populate('role_id');
    } else {
      users = await User.find({ number }).populate('role_id');
    }
    const formatted = users.map(u => ({
      id: u.id || String(u._id),
      _id: u._id,
      first_name: u.first_name,
      middle_name: u.middle_name || '',
      last_name: u.last_name || '',
      name: fullName(u),
      email: u.email || '',
      number: u.number,
      gender: u.gender || '',
      dob: u.dob || null,
      relation: u.relation || 'Self',
      is_committee: u.is_committee || false,
      role_name: u.role_id?.name || '',
      status: Number(u.status ?? 1),
      familyHead: u.familyHead || false,
      image: publicUrl(req, u.image || u.profile_image || '')
    }));

    return apiResponse(res, 200, 'Family members retrieved successfully', formatted);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving family members', { error: error.message });
  }
};


// Get single user by id
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') return apiResponse(res, 400, 'User id is required');

    const query = mongooseQueryForUser(id);
    const user = await User.findOne(query).populate('role_id');
    if (!user) return apiResponse(res, 404, 'User not found');

    const formatted = {
      id: user.id || String(user._id),
      _id: user._id,
      first_name: user.first_name,
      middle_name: user.middle_name || '',
      last_name: user.last_name || '',
      name: fullName(user),
      email: user.email || '',
      number: user.number,
      gender: user.gender || '',
      dob: user.dob || null,
      anniversary: user.anniversary || null,
      blood_group: user.blood_group || '',
      relation: user.relation || 'Self',
      is_committee: user.is_committee || false,
      committee_role: user.committee_role || '',
      designation: user.designation || '',
      country_id: user.country_id || '',
      state_id: user.state_id || '',
      city_id: user.city_id || '',
      village: user.village || user.village_id || '',
      village_id: user.village_id || '',
      role_id: user.role_id?._id ? String(user.role_id._id) : '',
      role_name: user.role_id?.name || '',
      address: user.address || '',
      status: Number(user.status ?? 1),
      familyHead: user.familyHead || false,
      image: publicUrl(req, user.image || user.profile_image || ''),
      role: user.is_committee ? 'admin' : 'user'
    };

    return apiResponse(res, 200, 'User retrieved successfully', formatted);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving user', { error: error.message });
  }
};


const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const isSelfUpdate = [
      req.user?._id,
      req.user?.id,
    ].some((value) => value && String(value) === String(id));
    const isRoleUpdate = [
      'role',
      'role_id',
      'committee_role',
      'is_committee',
      'permissions'
    ].some((field) => req.body[field] !== undefined);

    if (isSelfUpdate && isRoleUpdate) {
      return res.status(403).json({ message: 'You cannot change your own role.' });
    }

    const {
      first_name,
      middle_name,
      last_name,
      email,
      number,
      gender,
      dob,
      anniversary,
      blood_group,
      relation,
      is_committee,
      committee_role,
      role_id,
      country_id,
      state_id,
      city_id,
      village,
      village_id,
      address,
      designation,
      image,
      password,
      status,
      familyHead
    } = req.body;


    const query = mongooseQueryForUser(id);
    const user = await User.findOne(query);
    if (!user) {
      return apiResponse(res, 404, 'User not found');
    }

    let familyData = { family_head: user.family_head, relation: user.relation, status: user.status };
    if (relation !== undefined || req.body.family_head_id !== undefined || familyHead !== undefined) {
      try {
        familyData = await familyUtil.prepareFamilyFields({
          relation,
          family_head_id: req.body.family_head_id,
          status,
          familyHead,
          is_deceased: req.body.is_deceased !== undefined ? (req.body.is_deceased === true || req.body.is_deceased === 'true') : user.is_deceased
        }, user);
      } catch (e) {
        console.warn('prepareFamilyFields warning:', e.message);
      }
    }

    if ((is_committee === true || is_committee === 'true' || user.is_committee) && req.file?.size > 1024 * 1024) {
      return apiResponse(res, 400, 'Committee image must be 1 MB or smaller');
    }

    if (first_name) user.first_name = first_name;
    if (middle_name !== undefined) user.middle_name = middle_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (email !== undefined) user.email = email.toLowerCase();
    if (number !== undefined) user.number = number;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (anniversary !== undefined) user.anniversary = anniversary;
    if (blood_group !== undefined) user.blood_group = blood_group;
    if (relation !== undefined) user.relation = familyData.relation;
    if (is_committee !== undefined) user.is_committee = is_committee === true || is_committee === 'true';
    if (committee_role !== undefined) user.committee_role = committee_role;
    if (role_id !== undefined) user.role_id = role_id && mongoose.isValidObjectId(role_id) ? role_id : null;
    if (country_id !== undefined) user.country_id = country_id;
    if (state_id !== undefined) user.state_id = state_id;
    if (city_id !== undefined) user.city_id = city_id;
    if (village !== undefined) user.village = village;
    if (village_id !== undefined) user.village_id = village_id;
    if (address !== undefined) user.address = address;
    if (designation !== undefined) user.designation = designation;
    if (status !== undefined) user.status = Number(status);
    if (familyHead !== undefined) user.familyHead = familyHead === true || familyHead === 'true';
    if (familyData.family_head !== undefined && (relation !== undefined || req.body.family_head_id !== undefined || familyHead !== undefined)) {
      user.family_head = familyData.family_head;
    }
    if (password) user.password = password;
    if (req.body.image !== undefined) {
      user.image = req.body.image;
    } else if (req.file) {
      user.image = `/uploads/${req.file.filename}`;
    }

    if (req.body.is_deceased !== undefined) user.is_deceased = req.body.is_deceased === true || req.body.is_deceased === 'true';
    if (req.body.death_date !== undefined) user.death_date = req.body.death_date ? new Date(req.body.death_date) : null;
    if (req.body.death_time !== undefined) user.death_time = req.body.death_time;
    if (req.body.death_place !== undefined) user.death_place = req.body.death_place;
    if (req.body.death_note !== undefined) user.death_note = req.body.death_note;
    if (req.body.janaza_date !== undefined) user.janaza_date = req.body.janaza_date ? new Date(req.body.janaza_date) : null;
    if (req.body.janaza_time !== undefined) user.janaza_time = req.body.janaza_time;
    if (req.body.janaza_place !== undefined) user.janaza_place = req.body.janaza_place;
    if (req.body.kabrastan !== undefined) user.kabrastan = req.body.kabrastan;
    if (req.body.ziyarat_date !== undefined) {
      user.ziyarat_date = req.body.ziyarat_date ? new Date(req.body.ziyarat_date) : null;
      user.besnu_date = user.ziyarat_date;
    } else if (req.body.besnu_date !== undefined) {
      user.besnu_date = req.body.besnu_date ? new Date(req.body.besnu_date) : null;
      user.ziyarat_date = user.besnu_date;
    }
    if (req.body.ziyarat_time !== undefined) {
      user.ziyarat_time = req.body.ziyarat_time;
      user.besnu_time = req.body.ziyarat_time;
    } else if (req.body.besnu_time !== undefined) {
      user.besnu_time = req.body.besnu_time;
      user.ziyarat_time = req.body.besnu_time;
    }
    if (req.body.ziyarat_place !== undefined) {
      user.ziyarat_place = req.body.ziyarat_place;
      user.besnu_place = req.body.ziyarat_place;
    } else if (req.body.besnu_place !== undefined) {
      user.besnu_place = req.body.besnu_place;
      user.ziyarat_place = req.body.besnu_place;
    }

    await user.save();

    // Handle updating/creating/deleting child family members if passed
    let membersList = req.body.members;
    if (typeof membersList === 'string') {
      try {
        membersList = JSON.parse(membersList);
      } catch (e) {
        membersList = [];
      }
    }

    let deletedMemberIds = req.body.deletedMemberIds;
    if (typeof deletedMemberIds === 'string') {
      try {
        deletedMemberIds = JSON.parse(deletedMemberIds);
      } catch (e) {
        deletedMemberIds = [];
      }
    }

    if (Array.isArray(deletedMemberIds) && deletedMemberIds.length > 0) {
      await User.deleteMany({
        _id: { $in: deletedMemberIds },
        $or: [
          { 'family_head.id': user._id },
          { 'family_head.id': String(user._id) }
        ]
      });
    }

    if (Array.isArray(membersList) && membersList.length > 0) {
      const latestUserWithId = await User.findOne({ member_id: /^\d+$/ })
        .sort({ createdAt: -1, _id: -1 })
        .select('member_id')
        .lean();
      let currentMaxId = latestUserWithId && !isNaN(Number(latestUserWithId.member_id))
        ? Number(latestUserWithId.member_id)
        : 0;

      for (const m of membersList) {
        if (!m.first_name || !m.first_name.trim()) continue;
        const memberId = m._id || m.id;
        if (memberId && mongoose.isValidObjectId(memberId)) {
          // Update existing child member
          await User.findOneAndUpdate(
            { _id: memberId },
            {
              $set: {
                first_name: m.first_name.trim(),
                middle_name: m.middle_name !== undefined ? m.middle_name.trim() : (user.first_name || ''),
                last_name: m.last_name !== undefined ? m.last_name.trim() : (user.last_name || ''),
                email: m.email ? m.email.toLowerCase().trim() : '',
                number: m.number ? m.number.trim() : (user.number || ''),
                gender: m.gender || 'Male',
                dob: m.dob || null,
                anniversary: m.anniversary || null,
                blood_group: m.blood_group || '',
                relation: m.relation || 'Other',
                status: m.status !== undefined ? Number(m.status) : 1,
                country_id: user.country_id,
                state_id: user.state_id,
                city_id: user.city_id,
                village: user.village,
                address: user.address,
                ...(m.image !== undefined ? { image: m.image } : {}),
                family_head: {
                  id: user._id,
                  name: fullName(user)
                },
                familyHead: false
              }
            }
          );
        } else {
          // Create new child member
          currentMaxId += 1;
          const childUser = new User({
            member_id: String(currentMaxId),
            first_name: m.first_name.trim(),
            middle_name: m.middle_name ? m.middle_name.trim() : (user.first_name || ''),
            last_name: m.last_name ? m.last_name.trim() : (user.last_name || ''),
            email: m.email ? m.email.toLowerCase().trim() : '',
            password: m.password || '12345',
            number: m.number ? m.number.trim() : (user.number || ''),
            gender: m.gender || 'Male',
            dob: m.dob || null,
            anniversary: m.anniversary || null,
            blood_group: m.blood_group || '',
            relation: m.relation || 'Other',
            country_id: user.country_id,
            state_id: user.state_id,
            city_id: user.city_id,
            village: user.village,
            village_id: user.village_id,
            address: user.address,
            image: m.image || m.profile_image || '',
            family_head: {
              id: user._id,
              name: fullName(user)
            },
            familyHead: false,
            status: m.status !== undefined ? Number(m.status) : (user.status !== undefined ? Number(user.status) : 1)
          });
          await childUser.save();
        }
      }
    }

    return apiResponse(res, 200, 'User updated  ', {
      id: user._id,
      first_name: user.first_name,
      middle_name: user.middle_name || '',
      last_name: user.last_name || '',
      email: user.email,
      number: user.number,
      gender: user.gender || '',
      dob: user.dob || null,
      anniversary: user.anniversary || null,
      blood_group: user.blood_group || '',
      relation: user.relation || 'Self',
      is_committee: user.is_committee || false,
      committee_role: user.committee_role || '',
      role_id: user.role_id ? String(user.role_id) : '',
      country_id: user.country_id || '',
      state_id: user.state_id || '',
      city_id: user.city_id || '',
      village: user.village || user.village_id || '',
      address: user.address || '',
      designation: user.designation || '',
      status: Number(user.status ?? 1),
      familyHead: user.familyHead || false,
      image: publicUrl(req, user.image || ''),

    });
  } catch (error) {
    return apiResponse(res, 500, 'Error updating user', { error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return apiResponse(res, 404, 'User not found');
    }

    // Delete user's image from external service
    const userImage = user.image || user.profile_image || '';
    if (userImage) {
      deleteFileFromExternalService(userImage).catch(() => { });
    }

    await User.deleteOne({ _id: id });
    return apiResponse(res, 200, 'User deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting user', { error: error.message });
  }
};

const bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, status } = req.body;
    if (!userIds || !Array.isArray(userIds)) {
      return apiResponse(res, 400, 'userIds array is required');
    }
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { status: Number(status) } }
    );
    return apiResponse(res, 200, 'Users updated successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error updating users', { error: error.message });
  }
};

/**
 * Bulk import members from an uploaded Excel (.xlsx/.xls) file.
 * Family grouping logic (Option A):
 *   - Row with Relation=Self OR Is Family Head=Yes  → becomes a family head
 *   - Subsequent rows (until next head) → linked to the most recent head
 * Duplicate handling: skip row if mobile number already exists, report in errors array.
 */
const bulkImportUsers = async (req, res) => {
  try {
    if (!req.file) {
      return apiResponse(res, 400, 'Excel file is required');
    }

    // Parse Excel buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return apiResponse(res, 400, 'Excel file is empty or has no data rows');
    }

    // Helper to normalise column header keys (trim + lowercase)
    const getVal = (row, ...keys) => {
      for (const key of keys) {
        const found = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (found !== undefined && row[found] !== undefined && String(row[found]).trim() !== '') {
          return String(row[found]).trim();
        }
      }
      return '';
    };

    // Helper to parse date (handles Excel date objects and string formats)
    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const str = String(val).trim();
      if (!str) return null;
      // Try DD-MM-YYYY
      const ddmmyyyy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (ddmmyyyy) {
        const d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    };

    // Get the role to assign by default
    const Role = require('../models/roleModel');
    const defaultRole = await Role.findOne({ name: 'UserRole' });

    // Get current highest member_id
    const latestUser = await User.findOne({ member_id: /^\d+$/ })
      .sort({ createdAt: -1, _id: -1 })
      .select('member_id')
      .lean();
    let nextMemberId = latestUser && !isNaN(Number(latestUser.member_id))
      ? Number(latestUser.member_id) + 1
      : (await User.countDocuments()) + 1;

    const created = [];
    const errors = [];
    let currentHead = null; // tracks the last created family head User doc

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (1 = header)

      const firstName = getVal(row, 'First Name', 'first_name', 'firstname', 'name');
      const number = getVal(row, 'Mobile Number', 'mobile number', 'mobile', 'number', 'phone');

      if (!firstName) {
        errors.push({ row: rowNum, reason: 'First Name is required' });
        continue;
      }
      if (!number) {
        errors.push({ row: rowNum, name: firstName, reason: 'Mobile Number is required' });
        continue;
      }

      // Duplicate check by mobile number
      const existing = await User.findOne({ number });
      if (existing) {
        errors.push({ row: rowNum, name: firstName, reason: `Mobile number ${number} already exists` });
        continue;
      }

      const isFamilyHeadVal = getVal(row, 'Is Family Head', 'is family head', 'family head', 'familyhead').toLowerCase();
      const relation = getVal(row, 'Relation', 'relation') || 'Self';
      const isFamilyHead = isFamilyHeadVal === 'yes' || isFamilyHeadVal === '1' || isFamilyHeadVal === 'true' || relation.toLowerCase() === 'self';

      try {
        const newUser = new User({
          member_id: String(nextMemberId),
          first_name: firstName,
          middle_name: getVal(row, 'Middle Name', 'middle_name', 'middlename'),
          last_name: getVal(row, 'Last Name', 'last_name', 'lastname', 'surname'),
          email: getVal(row, 'Email', 'email').toLowerCase() || '',
          password: '12345',
          number,
          gender: getVal(row, 'Gender', 'gender') || '',
          dob: parseDate(getVal(row, 'Date of Birth', 'dob', 'birth date', 'birthdate')),
          anniversary: parseDate(getVal(row, 'Anniversary', 'anniversary', 'wedding date')),
          blood_group: getVal(row, 'Blood Group', 'blood group', 'blood_group'),
          address: getVal(row, 'Address', 'address'),
          relation: isFamilyHead ? 'Self' : (relation || 'Other'),
          familyHead: isFamilyHead,
          status: 1,
          role_id: defaultRole ? defaultRole._id : undefined
        });

        if (isFamilyHead) {
          // Save first to get _id, then set family_head to self
          await newUser.save();
          newUser.family_head = { id: newUser._id, name: fullName(newUser) };
          await newUser.save();
          currentHead = newUser;
        } else {
          // Link to current head
          if (currentHead) {
            newUser.family_head = { id: currentHead._id, name: fullName(currentHead) };
            newUser.parent_member_id = String(currentHead.member_id);
          }
          await newUser.save();
        }

        nextMemberId++;
        created.push({
          member_id: newUser.member_id,
          name: fullName(newUser),
          number: newUser.number
        });
      } catch (saveErr) {
        errors.push({ row: rowNum, name: firstName, reason: saveErr.message });
      }
    }

    return apiResponse(res, 200, `Import complete: ${created.length} created, ${errors.length} failed`, {
      created_count: created.length,
      failed_count: errors.length,
      created,
      errors
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error importing users', { error: error.message });
  }
};
/**
 * Export all members / family registry as an Excel sheet from backend.
 * Respects search, gender, status, blood_group, village filters.
 */
const exportUsers = async (req, res) => {
  try {
    const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchFields = ['first_name', 'middle_name', 'last_name', 'number', 'email', 'village', 'family_head.name'];

    const headCriteria = {
      $or: [
        { familyHead: true },
        { relation: 'Self' }
      ]
    };

    const headClauses = [headCriteria];

    // Handle search
    if (req.query.search && String(req.query.search).trim()) {
      const rawSearch = String(req.query.search).trim();
      const tokens = rawSearch.split(/\s+/).filter(Boolean);

      let searchCondition;
      if (tokens.length === 1) {
        const searchRegex = new RegExp(escapeRegExp(tokens[0]), 'i');
        searchCondition = { $or: searchFields.map(field => ({ [field]: searchRegex })) };
      } else {
        const tokenClauses = tokens.map(token => {
          const tokenRegex = new RegExp(escapeRegExp(token), 'i');
          return { $or: searchFields.map(field => ({ [field]: tokenRegex })) };
        });
        searchCondition = { $and: tokenClauses };
      }

      const [matchingChildHeadIds, matchingChildParentMemberIds] = await Promise.all([
        User.find({
          ...searchCondition,
          relation: { $ne: 'Self' },
          familyHead: { $ne: true }
        }).distinct('family_head.id'),
        User.find({
          ...searchCondition,
          relation: { $ne: 'Self' },
          familyHead: { $ne: true },
          parent_member_id: { $exists: true, $ne: null, $ne: '' }
        }).distinct('parent_member_id')
      ]);

      const validHeadObjectIds = (matchingChildHeadIds || [])
        .filter(id => id && mongoose.isValidObjectId(id))
        .map(id => new mongoose.Types.ObjectId(id));

      const validParentMemberIds = (matchingChildParentMemberIds || []).filter(Boolean);

      const headSearchOr = [
        searchCondition,
        ...(validHeadObjectIds.length ? [{ _id: { $in: validHeadObjectIds } }] : []),
        ...(validParentMemberIds.length ? [{ member_id: { $in: validParentMemberIds } }] : [])
      ];

      headClauses.push({ $or: headSearchOr });
    }

    // Handle filters
    if (req.query.gender) {
      headClauses.push({ gender: req.query.gender });
    }
    if (req.query.blood_group) {
      headClauses.push({ blood_group: req.query.blood_group });
    }
    if (req.query.village) {
      headClauses.push({ $or: [{ village: req.query.village }, { village_id: req.query.village }] });
    }
    if (req.query.status !== undefined && req.query.status !== '') {
      const sVal = Number(req.query.status);
      if (!isNaN(sVal)) {
        if (sVal === 1) {
          headClauses.push({ $or: [{ status: 1 }, { status: '1' }, { status: { $exists: false } }, { status: null }] });
        } else {
          headClauses.push({ $or: [{ status: 0 }, { status: '0' }] });
        }
      }
    }

    const finalHeadQuery = headClauses.length === 1 ? headClauses[0] : { $and: headClauses };

    const heads = await User.find(finalHeadQuery)
      .sort({ createdAt: -1, _id: -1 })
      .populate('role_id');

    const headObjectIds = heads.map(h => h._id);
    const headIdStrings = heads.map(h => String(h._id));
    const headMemberIds = heads.map(h => String(h.member_id)).filter(Boolean);

    let childMembers = [];
    if (headObjectIds.length > 0) {
      const childQuery = {
        _id: { $nin: headObjectIds },
        $or: [
          { 'family_head.id': { $in: headObjectIds } },
          { 'family_head.id': { $in: headIdStrings } },
          { parent_member_id: { $in: headMemberIds } }
        ]
      };
      childMembers = await User.find(childQuery)
        .sort({ createdAt: 1, _id: 1 })
        .populate('role_id');
    }

    // Prepare rows for Excel
    const excelRows = [];
    for (const head of heads) {
      const headIdStr = String(head._id);
      const headMemberIdStr = String(head.member_id || '');
      const matchingChildren = childMembers.filter(m => {
        const mHeadId = String(m.family_head?.id || m.family_head?._id || '');
        const mParentId = String(m.parent_member_id || '');
        return (mHeadId && (mHeadId === headIdStr || mHeadId === headMemberIdStr)) ||
          (mParentId && (mParentId === headMemberIdStr || mParentId === headIdStr));
      });

      // Add Head row
      excelRows.push({
        member_id: head.member_id || '',
        name: fullName(head),
        relation: 'Family Head (મુખ્ય)',
        number: head.number || '',
        email: head.email || 'No Email',
        gender: head.gender || '',
        blood_group: head.blood_group || '',
        village: head.village || '',
        status: Number(head.status ?? 1) === 1 ? 'Active' : 'Inactive',
        isHead: true
      });

      // Add Child members under head
      for (const child of matchingChildren) {
        excelRows.push({
          member_id: child.member_id || '',
          name: `  ↳ ${fullName(child)}`,
          relation: child.relation || 'Member',
          number: child.number || '',
          email: child.email || 'No Email',
          gender: child.gender || '',
          blood_group: child.blood_group || '',
          village: child.village || head.village || '',
          status: Number(child.status ?? 1) === 1 ? 'Active' : 'Inactive',
          isHead: false
        });
      }
    }

    // Build workbook with ExcelJS for rich styling (header colors, status colors, borders)
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Parivar App';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Family Registry', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: 'Member ID', key: 'member_id', width: 16 },
      { header: 'Name', key: 'name', width: 36 },
      { header: 'Relation', key: 'relation', width: 26 },
      { header: 'Mobile Number', key: 'number', width: 22 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'Gender', key: 'gender', width: 14 },
      { header: 'Blood Group', key: 'blood_group', width: 14 },
      { header: 'Village', key: 'village', width: 22 },
      { header: 'Status', key: 'status', width: 18 }
    ];

    // Style the Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Professional Royal Navy Blue
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' } // Crisp White
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF93C5FD' } },
        left: { style: 'thin', color: { argb: 'FF93C5FD' } },
        bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
        right: { style: 'thin', color: { argb: 'FF93C5FD' } }
      };
    });

    // Populate data rows with styles
    for (const item of excelRows) {
      const row = worksheet.addRow({
        member_id: item.member_id,
        name: item.name,
        relation: item.relation,
        number: item.number,
        email: item.email,
        gender: item.gender,
        blood_group: item.blood_group,
        village: item.village,
        status: item.status
      });

      row.height = 24;

      row.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: item.isHead && (colNumber === 2 || colNumber === 3)
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Alignments: Name, Relation, Email, Village to left; others centered
        if ([2, 3, 5, 8].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });

      // Special styling for Family Head
      if (item.isHead) {
        row.getCell('relation').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
      }

      // Status cell formatting: Inactive = Red, Active = Green
      const statusCell = row.getCell('status');
      if (item.status === 'Active') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6F4EA' } // Light Green background
        };
        statusCell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: true,
          color: { argb: 'FF137333' } // Dark Green text
        };
      } else {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE8E6' } // Light Red background
        };
        statusCell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: true,
          color: { argb: 'FFC5221F' } // Dark Red text
        };
      }
    }

    worksheet.autoFilter = 'A1:I1';

    const buffer = await workbook.xlsx.writeBuffer();

    // Ensure exports directory exists
    const exportDir = path.join(__dirname, '../../public/uploads/exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Clean up old export files older than 24 hours
    try {
      const existingFiles = fs.readdirSync(exportDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;
      for (const file of existingFiles) {
        const fPath = path.join(exportDir, file);
        const stat = fs.statSync(fPath);
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(fPath);
        }
      }
    } catch (_) { }

    const dateStr = new Date().toISOString().slice(0, 10);
    const timestamp = Date.now();
    const filename = `Family_Registry_${dateStr}_${timestamp}.xlsx`;
    const filePath = path.join(exportDir, filename);

    fs.writeFileSync(filePath, buffer);

    // If direct buffer download was explicitly requested
    if (req.query.direct === 'true') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).send(buffer);
    }

    // Resolve canonical base URL and route prefix
    const resolveBaseUrl = (request) => {
      if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
      if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
      if (request) {
        const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
        const host = request.headers['x-forwarded-host'] || request.get('host') || 'localhost:5006';
        return `${protocol}://${host}`;
      }
      return 'http://localhost:5006';
    };

    const baseUrl = resolveBaseUrl(req);
    const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host') || '';
    const referer = req?.headers?.['referer'] || '';
    const isApiApi = (req?.originalUrl && req.originalUrl.includes('/api/api')) ||
      host.includes('parivar.me') ||
      referer.includes('parivar.me');
    const prefix = isApiApi ? '/api/api' : '/api';

    const downloadUrl = `${baseUrl}${prefix}/users/export/download/${encodeURIComponent(filename)}`;

    return res.status(200).json({
      status: 200,
      message: 'Family registry exported successfully',
      data: {
        download_url: downloadUrl,
        filename
      }
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error exporting users', { error: error.message });
  }
};

/**
 * Direct file download endpoint for exported users/family registry.
 * Streams the saved Excel file with proper Content-Disposition header.
 */
const downloadExportFile = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return apiResponse(res, 400, 'Invalid filename');
    }

    const safeFilename = path.basename(filename);
    const exportDir = path.join(__dirname, '../../public/uploads/exports');
    const filePath = path.join(exportDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return apiResponse(res, 404, 'Export file not found or expired');
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.sendFile(filePath);
  } catch (error) {
    return apiResponse(res, 500, 'Error downloading export file', { error: error.message });
  }
};

// Download Death / Vafat Notification Card (PNG or PDF)
const downloadDeathCard = async (req, res) => {
  try {
    const { id } = req.params;
    const format = String(req.query.format || req.query.type || 'png').toLowerCase();
    const isInline = String(req.query.inline || req.query.preview || 'false').toLowerCase() === 'true';

    const orConditions = [{ member_id: id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.unshift({ _id: id });
    }

    const user = await User.findOne({ $or: orConditions })
      .populate('family_head', 'first_name middle_name last_name name')
      .lean();

    if (!user) {
      return res.status(404).json({
        status: 404,
        message: 'Deceased member record not found',
        data: null
      });
    }

    // Resolve community name from query or config
    let communityName = req.query.community_name || req.query.communityName || '';
    if (!communityName) {
      try {
        const Config = require('../models/configModel');
        const config = await Config.findOne().lean();
        communityName = config?.name || config?.web_name || 'Shree Halai Memon Jamat';
      } catch (_) {
        communityName = 'Shree Halai Memon Jamat';
      }
    }

    const memberName = fullName(user) || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Member';
    const isFemale = String(user.gender || '').toLowerCase() === 'female';
    const titlePrefix = isFemale ? 'Marhuma' : 'Marhum';
    const safeName = memberName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `vafat_${titlePrefix}_${safeName}`;

    // Render HTML string
    const htmlContent = await renderVafatCardHtml(user, {
      communityName,
      format,
      isPdf: format === 'pdf'
    });

    const lockKey = `vafat_card_${id}_${format}`;

    if (format === 'pdf') {
      const pdfBuffer = await synchronizedGeneratePdf(lockKey, async () => {
        return generatePdfFromHtml(htmlContent, {
          filename,
          format: 'A4',
          orientation: 'portrait'
        });
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${filename}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}.pdf`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).send(pdfBuffer);
    } else {
      // Default: High-Resolution PNG image
      const imageBuffer = await synchronizedGeneratePdf(lockKey, async () => {
        return generateImageFromHtml(htmlContent, {
          filename,
          width: 560,
          deviceScaleFactor: 2.5
        });
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${filename}.png"; filename*=UTF-8''${encodeURIComponent(filename)}.png`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).send(imageBuffer);
    }
  } catch (error) {
    console.error('Error generating vafat card download:', error);
    return res.status(500).json({
      status: 500,
      message: 'Failed to generate vafat card',
      error: error.message
    });
  }
};

// Get Direct Download Links & Metadata for Death Card (for Mobile Apps)
const getDeathCardLink = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ member_id: id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.unshift({ _id: id });
    }

    const user = await User.findOne({ $or: orConditions }).lean();
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: 'Deceased member record not found',
        data: null
      });
    }

    const memberId = String(user._id || user.id);
    const memberName = fullName(user) || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Member';
    const isFemale = String(user.gender || '').toLowerCase() === 'female';
    const titlePrefix = isFemale ? 'Marhuma' : 'Marhum';

    const pngUrl = buildDeathDownloadUrl(memberId, req, 'png');
    const pdfUrl = buildDeathDownloadUrl(memberId, req, 'pdf');

    return res.status(200).json({
      status: 200,
      message: 'Death card download link generated successfully',
      data: {
        id: memberId,
        member_id: user.member_id || '',
        name: memberName,
        title_prefix: titlePrefix,
        download_url: pngUrl,
        png_url: pngUrl,
        pdf_url: pdfUrl,
        death_date: user.death_date || null,
        janaza_date: user.janaza_date || null,
        janaza_time: user.janaza_time || '',
        janaza_place: user.janaza_place || '',
        kabrastan: user.kabrastan || ''
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Failed to retrieve death card link',
      error: error.message
    });
  }
};

module.exports = {
  register,
  // login,
  getProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getFamilyMembers,
  getFamilyMembersByNumber,
  bulkUpdateUsers,
  bulkImportUsers,
  exportUsers,
  downloadExportFile,
  downloadDeathCard,
  getDeathCardLink
};

