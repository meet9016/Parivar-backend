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
const { generateExcelExport, sendExportedExcelFile } = require('../utils/excelHelper');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfamilykey';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '365d';

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

    if (!first_name || !number) {
      return res.status(400).json({ message: 'First name and number are required' });
    }

    if (email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }
    }

    const familyData = await prepareFamilyFields({
      relation,
      family_head_id: req.body.family_head_id,
      status: req.body.status,
      familyHead
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
  return { id: String(id) };
};

const getUsers = async (req, res) => {
  try {
    const birthday = 'birthday' in req.query;
    const anniversary = 'anniversary' in req.query;

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
      const rawHeadId = req.query.family_head_id;
      if (mongoose.isValidObjectId(rawHeadId)) {
        query.$or = [
          { 'family_head.id': new mongoose.Types.ObjectId(rawHeadId) },
          { 'family_head.id': String(rawHeadId) },
          { _id: new mongoose.Types.ObjectId(rawHeadId) }
        ];
      } else {
        query.$or = [
          { parent_member_id: String(rawHeadId) },
          { member_id: String(rawHeadId) }
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

    // Determine if this is the Family Registry listing request (default view in Users.jsx)
    const isFamilyRegistryListing =
      !birthday &&
      !anniversary &&
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

      // Handle search: if search matches head OR any child member, include their family head
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
      select: (birthday || anniversary) ? '_id first_name middle_name last_name number dob anniversary' : '-password',
      populate: (birthday || anniversary) ? '' : 'role_id',
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

    const familyData = await familyUtil.prepareFamilyFields({
      relation,
      family_head_id: req.body.family_head_id,
      status,
      familyHead
    }, user);

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
    user.family_head = familyData.family_head;
    if (password) user.password = password;
    if (req.body.image !== undefined) {
      user.image = req.body.image;
    } else if (req.file) {
      user.image = `/uploads/${req.file.filename}`;
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

    // 1. Delete user's image from external service
    const userImage = user.image || user.profile_image || '';
    if (userImage) {
      deleteFileFromExternalService(userImage).catch(() => { });
    }

    // 2. Cascade delete all family members under this head
    const childConditions = [
      { 'family_head.id': user._id },
      { 'family_head.id': String(user._id) },
      { parent_id: user._id },
      { parent_id: String(user._id) }
    ];
    if (user.member_id) {
      childConditions.push({ parent_member_id: String(user.member_id) });
    }

    const linkedMembers = await User.find({
      _id: { $ne: user._id },
      $or: childConditions
    });

    for (const m of linkedMembers) {
      const img = m.image || m.profile_image || '';
      if (img) {
        deleteFileFromExternalService(img).catch(() => { });
      }
    }

    if (linkedMembers.length > 0) {
      const linkedIds = linkedMembers.map(m => m._id);
      await User.deleteMany({ _id: { $in: linkedIds } });
    }

    // 3. Delete the head user
    await User.deleteOne({ _id: id });
    return apiResponse(res, 200, 'User and all linked family members deleted successfully');
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

    // Helper to normalise column header keys (trim + lowercase + remove asterisks)
    const cleanHeader = (str) => String(str || '').replace(/[\*:]/g, '').replace(/[\s_-]+/g, ' ').trim().toLowerCase();

    const getVal = (row, ...keys) => {
      for (const key of keys) {
        const target = cleanHeader(key);
        const found = Object.keys(row).find(k => cleanHeader(k) === target);
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

      // Skip template notes/instructions row
      const firstVal = String(Object.values(row)[0] || '').trim();
      if (firstVal.startsWith('*') && (firstVal.toLowerCase().includes('required') || firstVal.toLowerCase().includes('note'))) {
        continue;
      }

      const firstName = getVal(row, 'First Name', 'first_name', 'firstname', 'name');
      let number = getVal(row, 'Mobile Number', 'mobile number', 'mobile', 'number', 'phone', 'contact');
      if (number.endsWith('.0')) {
        number = number.slice(0, -2);
      }
      number = number.replace(/[\s-]/g, '');

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
  if ('birthday' in req.query) {
    return exportBirthdays(req, res);
  }
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

    const columns = [
      { header: 'Member ID', key: 'member_id', width: 14, align: 'center' },
      { header: 'Name', key: 'name', width: 36, align: 'left' },
      { header: 'Relation', key: 'relation', width: 24, align: 'left' },
      { header: 'Mobile Number', key: 'number', width: 18, align: 'center' },
      { header: 'Email', key: 'email', width: 30, align: 'left' },
      { header: 'Gender', key: 'gender', width: 12, align: 'center' },
      { header: 'Blood Group', key: 'blood_group', width: 14, align: 'center' },
      { header: 'Village', key: 'village', width: 26, align: 'left' },
      { header: 'Status', key: 'status', width: 14, align: 'center' }
    ];

    const rows = [];
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
      rows.push({
        _isHead: true,
        member_id: head.member_id || '',
        name: fullName(head),
        relation: 'Family Head (મુખ્ય)',
        number: head.number ? String(head.number) : '',
        email: head.email || '',
        gender: head.gender || '',
        blood_group: head.blood_group || '',
        village: head.village || '',
        status: Number(head.status ?? 1) === 1 ? 'Active' : 'Inactive'
      });

      // Add Child members under head
      for (const child of matchingChildren) {
        rows.push({
          _isChild: true,
          _height: 20,
          member_id: child.member_id || '',
          name: `  • ${fullName(child)}`,
          relation: child.relation || 'Member',
          number: child.number ? String(child.number) : '',
          email: child.email || '',
          gender: child.gender || '',
          blood_group: child.blood_group || '',
          village: child.village || head.village || '',
          status: Number(child.status ?? 1) === 1 ? 'Active' : 'Inactive'
        });
      }
    }

    const { download_url, filename } = await generateExcelExport({
      req,
      filePrefix: 'Family_Registry',
      sheetName: 'Family Registry',
      columns,
      rows,
      rowFormatter: (row, item) => {
        if (item._isHead) {
          row.height = 22;
          const nameCell = row.getCell('name');
          nameCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF000000' } };
          const relCell = row.getCell('relation');
          relCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1B365D' } };
        } else if (item._isChild) {
          row.height = 20;
          row.eachCell({ includeEmpty: true }, (cell) => {
            if (cell.font) cell.font.size = 10;
          });
          const nameCell = row.getCell('name');
          nameCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
          const relCell = row.getCell('relation');
          relCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF4B5563' } };
        }
      }
    });

    return apiResponse(res, 200, 'Family registry exported successfully', {
      download_url,
      filename,
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error exporting users', { error: error.message });
  }
};

/**
 * Export Birthdays and Anniversaries as an Excel sheet from backend.
 * Respects search, status, dob_month, dob_year, dob_start, dob_end filters.
 */
const exportBirthdays = async (req, res) => {
  try {
    const query = {
      dob: { $exists: true, $ne: null }
    };

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

    if (req.query.status !== undefined && req.query.status !== null && req.query.status !== '') {
      const sVal = Number(req.query.status);
      if (!isNaN(sVal)) {
        if (sVal === 1) {
          query.$or = [{ status: 1 }, { status: '1' }, { status: { $exists: false } }, { status: null }];
        } else {
          query.$or = [{ status: 0 }, { status: '0' }];
        }
      }
    }

    if (req.query.search && String(req.query.search).trim()) {
      const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapeRegExp(String(req.query.search).trim()), 'i');
      const searchFields = ['first_name', 'middle_name', 'last_name', 'number', 'email', 'village', 'family_head.name'];
      const searchOr = searchFields.map(field => ({ [field]: searchRegex }));
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const users = await User.find(query).sort({ dob: 1 }).lean();

    const formatBirthdate = (dateVal) => {
      if (!dateVal) return '-';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${d.getFullYear()}`;
    };

    const calculateAge = (dateVal) => {
      if (!dateVal) return '-';
      const birth = new Date(dateVal);
      if (isNaN(birth.getTime())) return '-';
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      let months = today.getMonth() - birth.getMonth();
      let days = today.getDate() - birth.getDate();
      if (days < 0) {
        months--;
        days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      }
      if (months < 0) {
        years--;
        months += 12;
      }
      const parts = [];
      if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
      if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
      if (days > 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
      return parts.length > 0 ? parts.join(', ') : '0 Days';
    };

    const calculateTimeMarried = (dateVal) => {
      if (!dateVal) return '-';
      const ann = new Date(dateVal);
      if (isNaN(ann.getTime())) return '-';
      const today = new Date();
      let years = today.getFullYear() - ann.getFullYear();
      let months = today.getMonth() - ann.getMonth();
      let days = today.getDate() - ann.getDate();
      if (days < 0) {
        months--;
        days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      }
      if (months < 0) {
        years--;
        months += 12;
      }
      if (years < 0) return '-';
      const parts = [];
      if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
      if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
      if (days > 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
      return parts.length > 0 ? parts.join(', ') : '0 Days';
    };

    const isSameDayAndMonth = (dateVal) => {
      if (!dateVal) return false;
      const today = new Date();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth() + 1;

      if (typeof dateVal === 'string' && dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts.length >= 2) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          return d === todayDay && m === todayMonth;
        }
      }

      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return false;

      return (
        (d.getUTCDate() === todayDay && (d.getUTCMonth() + 1) === todayMonth) ||
        (d.getDate() === todayDay && (d.getMonth() + 1) === todayMonth)
      );
    };

    // Sort items: today's birthdays or anniversaries first, matching UI behaviour
    const sortedUsers = [...users].sort((a, b) => {
      const aToday = isSameDayAndMonth(a.dob) || isSameDayAndMonth(a.anniversary);
      const bToday = isSameDayAndMonth(b.dob) || isSameDayAndMonth(b.anniversary);
      if (aToday && !bToday) return -1;
      if (!aToday && bToday) return 1;
      return 0;
    });

    const columns = [
      { header: 'MEMBER ID', key: 'member_id', width: 14, align: 'center' },
      { header: 'NAME', key: 'name', width: 32, align: 'left', bold: true },
      { header: 'MOBILE NUMBER', key: 'number', width: 18, align: 'center' },
      { header: 'DATE OF BIRTH', key: 'dob', width: 16, align: 'center' },
      { header: 'AGE', key: 'age', width: 22, align: 'center' },
      { header: 'ANNIVERSARY DATE', key: 'anniversary', width: 18, align: 'center' },
      { header: 'TIME MARRIED', key: 'married_for', width: 22, align: 'center' },
      { header: 'RELATION', key: 'relation', width: 16, align: 'left' },
      { header: 'VILLAGE', key: 'village', width: 20, align: 'left' },
      { header: 'STATUS', key: 'status', width: 14, align: 'center' }
    ];

    const rows = sortedUsers.map(user => {
      const isBday = isSameDayAndMonth(user.dob);
      const isAnniv = isSameDayAndMonth(user.anniversary);
      let celebrationTag = '';
      if (isBday && isAnniv) celebrationTag = ' (Today: Birthday & Anniversary! 🎉)';
      else if (isBday) celebrationTag = ' (Today: Birthday! 🎂)';
      else if (isAnniv) celebrationTag = ' (Today: Anniversary! 💖)';

      return {
        _isCelebrantToday: isBday || isAnniv,
        member_id: user.member_id || '-',
        name: `${fullName(user)}${celebrationTag}`.trim() || '-',
        number: user.number ? String(user.number) : '-',
        dob: formatBirthdate(user.dob),
        age: calculateAge(user.dob),
        anniversary: formatBirthdate(user.anniversary),
        married_for: calculateTimeMarried(user.anniversary),
        relation: user.relation || '-',
        village: user.village || '-',
        status: Number(user.status ?? 1) === 1 ? 'Active' : 'Inactive'
      };
    });

    const { download_url, filename } = await generateExcelExport({
      req,
      filePrefix: 'Birthdays_and_Anniversaries',
      sheetName: 'Birthdays',
      columns,
      rows,
      rowFormatter: (row, item) => {
        if (item._isCelebrantToday) {
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF3CD' }
            };
          });
          const nameCell = row.getCell('name');
          nameCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF856404' } };
        }
      }
    });

    return apiResponse(res, 200, 'Birthdays exported successfully', {
      download_url,
      filename
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error exporting birthdays', { error: error.message });
  }
};

const downloadExportedUsers = (req, res) => {
  return sendExportedExcelFile(req, res);
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
  exportBirthdays,
  downloadExportedUsers
};
