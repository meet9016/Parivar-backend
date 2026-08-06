const User = require('../models/userModels');
const Role = require('../models/roleModel');
const Business = require('../models/businessModel');
const Post = require('../models/postModel');
const Config = require('../models/configModel');
const Student = require('../models/studentModel');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { apiResponse, fullName, memberPublicId, publicUrl } = require('../utils/apiResponse');
const familyUtil = require('../utils/familyHelper');
const { getRolePermissions } = require('../middleware/auth');
const queryHelper = require('../utils/queryHelper');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfamilykey';

const {
  splitFullName,
  imageFromRequest,
  requestData,
  recoveryKeyFromRequest,
  escapeRegExp,
  adminRecoveryQuery,
  resolveRecoveryRoleId
} = require('../utils/adminHelpers');


//admin resgister
const createAdmin = async (req, res) => {

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
      role_id,
      address,
      designation,
      status,
      image,
      family_head_id,
      familyHead
    } = req.body;



    if (!first_name || !number) {
      return apiResponse(res, 400, 'First name and number are required');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiResponse(res, 400, 'Invalid email format');
    }

    if (await User.findOne({ email: email ? email.toLowerCase() : undefined })) {
      return apiResponse(res, 400, 'Email already exists');
    }
    if (await User.findOne({ number: number ? number : undefined })) {
      return apiResponse(res, 400, 'Number already exists');
    }

    if ((is_committee === true || is_committee === 'true') && req.file?.size > 1024 * 1024) {
      return apiResponse(res, 400, 'Committee image must be 1 MB or smaller');
    }

    const familyData = await familyUtil.prepareFamilyFields({
      relation,
      family_head_id: req.body.family_head_id,
      status,
      familyHead
    }, {});

    const assignedRoleId = role_id && mongoose.isValidObjectId(role_id) ? role_id : null;

    const users = await User.find({ member_id: /^\d+$/ }).select('member_id');
    

    const highestId = users.reduce((max, u) => {
      const num = Number(u.member_id);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);

    const newUser = new User({
      member_id: String(highestId + 1),
      first_name: first_name,
      middle_name: middle_name || '',
      last_name: last_name || '',
      email: email ? email.toLowerCase() : '',
      password: password || '12345',
      number: number,
      gender: gender || '',
      dob: dob || null,
      anniversary: anniversary || null,
      blood_group: blood_group || '',
      relation: familyData.relation,
      is_committee: is_committee === true || is_committee === 'true',
      committee_role: committee_role || '',
      role_id: assignedRoleId,
      address: address || '',
      designation: designation || '',
      status: familyData.status,
      family_head: familyData.family_head,

      image: imageFromRequest(req),
    });

    await newUser.save();

    if (familyData.relation === 'Self') {
      newUser.family_head = {
        id: newUser._id,
        name: familyUtil.fullName(newUser)
      };
      if (status === undefined) {
        newUser.status = 0;
      }
      await newUser.save();
    }

    return apiResponse(res, 201, 'User created successfully', {
      _id: newUser._id,
      first_name: newUser.first_name,
      middle_name: newUser.middle_name || '',
      last_name: newUser.last_name || '',
      email: newUser.email,
      number: newUser.number,
      gender: newUser.gender || '',
      dob: newUser.dob || null,
      anniversary: newUser.anniversary || null,
      blood_group: newUser.blood_group || '',
      relation: newUser.relation || 'Self',
      is_committee: newUser.is_committee || false,
      committee_role: newUser.committee_role || '',
      role_id: newUser.role_id ? String(newUser.role_id) : '',
      address: newUser.address || '',
      designation: newUser.designation || '',
      status: Number(newUser.status ?? 1),
      image: publicUrl(req, newUser.image || ''),


    });
  } catch (error) {
    return apiResponse(res, 500, 'Error creating user', { error: error.message });
  }
};

const CommitteeMember = require('../models/committeeMemberModel');
const bcrypt = require('bcryptjs');

// Admin login (email + password, checks is_committee & CommitteeMember)
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return apiResponse(res, 400, 'Email and password are required');
    }

    const emailQuery = email.trim().toLowerCase();

    // 1. Check CommitteeMember collection first for Committee Member Login
    const committeeMember = await CommitteeMember.findOne({ email: emailQuery }).select('+password').populate('role_id');

    if (committeeMember && committeeMember.password) {
      const isMatch = await bcrypt.compare(password, committeeMember.password);
      if (isMatch) {
        const permissions = getRolePermissions(committeeMember);

        const token = jwt.sign(
          { id: committeeMember._id },
          JWT_SECRET,
          { expiresIn: '1d' }
        );

        const userData = {
          id: String(committeeMember._id),
          name: `${committeeMember.first_name} ${committeeMember.last_name || ''}`.trim(),
          email: committeeMember.email,
          role: 'admin',
          is_committee: true,
          committee_role: committeeMember.designation || 'Committee Member',
          role_id: committeeMember.role_id?._id ? String(committeeMember.role_id._id) : (committeeMember.role_id || ''),
          role_name: committeeMember.role_id?.name || '',
          permissions,
          is_super_admin: false
        };

        return apiResponse(res, 200, 'Login successful', {
          token,
          user: userData
        });
      }
    }

    // 2. Fallback to User collection for legacy/main Admin login
    const user = await User.findOne({ email: emailQuery }).populate('role_id');

    if (user) {
      const isMatch = await user.comparePassword(password);
      if (isMatch) {
        const permissions = getRolePermissions(user);

        if (!user.is_committee && user.committee_role !== 'Self' && permissions.length === 0) {
          return apiResponse(res, 403, 'Access denied: Insufficient permissions');
        }

        const token = jwt.sign(
          { id: user._id },
          JWT_SECRET,
          { expiresIn: '1d' }
        );

        const userData = {
          id: user.id || String(user._id),
          name: fullName(user),
          email: user.email,
          role: user.is_committee ? 'admin' : 'user',
          is_committee: user.is_committee,
          committee_role: user.committee_role,
          role_id: user.role_id?._id ? String(user.role_id._id) : '',
          role_name: user.role_id?.name || '',
          permissions,
          is_super_admin: user.is_committee || user.relation === 'Self'
        };

        return apiResponse(res, 200, 'Login successful', {
          token,
          user: userData
        });
      }
    }

    return apiResponse(res, 401, 'Invalid email or password');
  } catch (error) {
    return apiResponse(res, 500, 'Error in login', { error: error.message });
  }
};

//tested

const updateAdminRecovery = async (req, res) => {
  try {
    const configuredRecoveryKey = process.env.ADMIN_RECOVERY_KEY;

    if (!configuredRecoveryKey) {
      return apiResponse(res, 503, 'Admin recovery is not configured');
    }

    if (String(recoveryKeyFromRequest(req) || '') !== String(configuredRecoveryKey)) {
      return apiResponse(res, 403, 'Forbidden: Invalid recovery key');
    }

    const data = requestData(req);
    const query = adminRecoveryQuery(data);

    if (!query) {
      return apiResponse(res, 400, 'Admin identifier is required');
    }

    const user = await User.findOne(query);
    if (!user) {
      return apiResponse(res, 404, 'Admin user not found');
    }

    const updates = [];
    const nextRoleId = await resolveRecoveryRoleId(data);

    if (data.password) {
      user.password = data.password;
      updates.push('password');
    }

    if (data.role !== undefined) {
      const roleValue = String(data.role).toLowerCase();
      if (roleValue === 'admin') {
        user.is_committee = true;
        updates.push('role');
      } else if (roleValue === 'member') {
        user.is_committee = false;
        user.role_id = null;
        updates.push('role');
      } else {
        return apiResponse(res, 400, 'Role must be admin or member');
      }
    }

    if (nextRoleId !== undefined) {
      user.role_id = nextRoleId;
      if (nextRoleId) {
        user.is_committee = true;
      }
      updates.push('role_id');
    }

    if (data.designation !== undefined || data.committee_role !== undefined) {
      const designation = data.designation ?? data.committee_role;
      user.designation = designation;
      user.committee_role = designation;
      if (designation) {
        user.is_committee = true;
      }
      updates.push('designation');
    }

    if (data.status !== undefined) {
      user.status = Number(data.status);
      updates.push('status');
    }

    if (updates.length === 0) {
      return apiResponse(res, 400, 'No recovery updates provided');
    }

    await user.save();

    return apiResponse(res, 200, 'Admin updated successfully', {
      id: user.id || String(user._id),
      _id: String(user._id),
      email: user.email || '',
      number: user.number || '',
      is_committee: user.is_committee,
      committee_role: user.committee_role || '',
      designation: user.designation || '',
      role_id: user.role_id ? String(user.role_id) : '',
      status: Number(user.status ?? 1),
      updated_fields: [...new Set(updates)]
    });
  } catch (error) {
    if (error.status) {
      return apiResponse(res, error.status, error.message);
    }

    return apiResponse(res, 500, 'Error updating admin recovery details', { error: error.message });
  }
};

// Aggregated Dashboard stats
const getStats = async (req, res) => {
  try {
    const [userCount, businessCount, postCount, committeeCount] = await Promise.all([
      User.countDocuments({}),
      Business.countDocuments({}),
      Post.countDocuments({}),
      User.countDocuments({ is_committee: true })
    ]);
    return apiResponse(res, 200, 'Dashboard statistics fetched successfully', {
      users: userCount,
      businesses: businessCount,
      posts: postCount,
      committee: committeeCount,
      orders: postCount * 4,
      revenue: businessCount * 1500
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error in getting stats', { error: error.message });
  }
};



module.exports = {
  createAdmin,
  loginAdmin,
  updateAdminRecovery,
  getStats,

};
