const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/userModels');
const { ALL_PERMISSION_KEYS } = require('../config/permissions');

const isInvalidTokenValue = (token) => {
  if (!token) {
    return true;
  }

  const normalized = token.trim().toLowerCase();

  return [
    'bearer',
    'null',
    'undefined',
    '{{token}}',
    '{{toakn}}',
    '{{admin-toakn}}'
  ].includes(normalized);
};

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const tokenHeader = req.headers.token || req.headers['x-auth-token'] || req.headers['x-access-token'];
  const headerValue = authHeader || tokenHeader;

  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const trimmedHeader = headerValue.trim();
  const bearerMatch = trimmedHeader.match(/^Bearer\s+(.+)$/i);

  const token = (bearerMatch ? bearerMatch[1] : trimmedHeader).trim();

  return isInvalidTokenValue(token) ? null : token;
};

const CommitteeMember = require('../models/committeeMemberModel');

const findUserFromToken = async (decoded) => {
  const userId = decoded.id || decoded._id || decoded.userId;

  if (userId && mongoose.isValidObjectId(userId)) {
    const user = await User.findById(userId).select('-password').populate('role_id');
    if (user) {
      return user;
    }

    const committeeMember = await CommitteeMember.findById(userId).select('-password').populate('role_id');
    if (committeeMember) {
      const cmObj = committeeMember.toObject ? committeeMember.toObject() : { ...committeeMember };
      cmObj.is_committee = true;
      return cmObj;
    }
  }

  if (userId) {
    const user = await User.findOne({ member_id: String(userId) }).select('-password').populate('role_id');
    if (user) {
      return user;
    }
  }

  if (decoded.member_id) {
    const user = await User.findOne({ member_id: String(decoded.member_id) }).select('-password').populate('role_id');
    if (user) {
      return user;
    }
  }

  if (decoded.number) {
    const user = await User.findOne({ number: String(decoded.number) }).select('-password').populate('role_id');
    if (user) return user;
    const committeeMember = await CommitteeMember.findOne({ number: String(decoded.number) }).select('-password').populate('role_id');
    if (committeeMember) {
      const cmObj = committeeMember.toObject ? committeeMember.toObject() : { ...committeeMember };
      cmObj.is_committee = true;
      return cmObj;
    }
  }

  return null;
};

const protect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      status: 401,
      message: 'Unauthorized: Token missing',
      data: []
    });
  }

  if (token.split('.').length !== 3) {
    return res.status(401).json({
      status: 401,
      message: 'Unauthorized: Invalid or expired token',
      data: []
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretfamilykey');
    req.user = await findUserFromToken(decoded);

    if (!req.user) {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized: Invalid or expired token',
        data: []
      });
    }

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized: Invalid or expired token',
        data: []
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized: Invalid or expired token',
        data: []
      });
    }

    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({
      status: 401,
      message: 'Unauthorized: Invalid or expired token',
      data: []
    });
  }
};

const getRolePermissions = (user = {}) => {
  if (user.committee_role === 'President') {
    return ALL_PERMISSION_KEYS;
  }

  const assignedRole = user.role_id;

  if (assignedRole && typeof assignedRole === 'object' && Number(assignedRole.status ?? 1) === 1) {
    return Array.isArray(assignedRole.permissions) ? assignedRole.permissions : [];
  }

  return [];
};

const ADMIN_CONTROLLED_USER_FIELDS = [
  'role',
  'role_id',
  'permissions',
  'is_committee',
  'committee_role',
  'status'
];

const isSameUser = (user = {}, id = '') => {
  const normalizedId = String(id || '');

  return [
    user._id,
    user.id,
    user.member_id
  ].some((value) => value && String(value) === normalizedId);
};

const isAdminUser = (user = {}) => (
  user.role === 'admin'
  || user.committee_role === 'President'
  || getRolePermissions(user).includes('members.edit')
);

const authorizeUserUpdate = (req, res, next) => {
  const targetId = req.params.id || req.body?.id || req.body?.member_id;
  const isAdmin = isAdminUser(req.user);
  const isSelfUpdate = targetId && isSameUser(req.user, targetId);
  const isRoleUpdate = ADMIN_CONTROLLED_USER_FIELDS.some((field) => (
    req.body && Object.prototype.hasOwnProperty.call(req.body, field)
  ));

  if (isAdmin && isSelfUpdate && isRoleUpdate) {
    return res.status(403).json({ message: 'You cannot change your own role.' });
  }

  if (isAdmin) {
    return next();
  }

  if (!targetId || !isSelfUpdate) {
    return res.status(403).json({
      status: 403,
      message: 'Forbidden: You do not have permission for this action',
      data: []
    });
  }

  ADMIN_CONTROLLED_USER_FIELDS.forEach((field) => {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
      delete req.body[field];
    }
  });

  return next();
};

const legacyPermissionFor = (permission) => {
  const legacyMap = {
    'members.': 'users.manage',
    'committee.': 'committee.manage',
    'roles.': 'roles.manage',
    'festivals.': 'festivals.manage',
    'events.': 'events.manage',
    'gallery.': 'gallery.manage',
    'banners.': 'banners.manage',
    'businesses.': 'businesses.manage',
    'news.': 'news.manage',
    'posts.': 'posts.manage',
    'matrimonies.': 'matrimonies.manage',
    'contact-inquiries.': 'contact-inquiries.manage',
    'settings.': 'settings.manage',
    'country.': 'masters.manage',
    'state.': 'masters.manage',
    'district.': 'masters.manage',
    'taluka.': 'masters.manage',
    'city.': 'masters.manage',
    'village.': 'masters.manage',
    'area.': 'masters.manage',
    'blood-group.': 'masters.manage',
    'event-category.': 'masters.manage',
    'news.': 'news.manage',
    'notice.': 'notice.manage',
    'reports.': 'reports.view',
    'dashboard.': 'dashboard.view',
    'users.': 'users.manage',
    'donations.': 'donations.manage',
    'feedback.': 'feedback.manage',
    'birthday.': 'users.manage',
    'job-vacancy.': 'job-vacancy.manage',
    'bank-details.': 'masters.manage',
    'expenses.': 'expenses.manage',
    'expense-category.': 'expense-category.manage'
  };

  return Object.entries(legacyMap).find(([prefix]) => permission.startsWith(prefix))?.[1] || permission;
};

const requirePermission = (permission) => async (req, res, next) => {
  const permissions = getRolePermissions(req.user);
  const resolvedPermission = typeof permission === 'function' ? permission(req) : permission;
  const required = Array.isArray(resolvedPermission) ? resolvedPermission : [resolvedPermission];
  const accepted = required.flatMap((item) => [item, legacyPermissionFor(item)]);

  if (accepted.some((item) => permissions.includes(item))) {
    return next();
  }

  return res.status(403).json({
    status: 403,
    message: 'Forbidden: You do not have permission for this action',
    data: []
  });
};

module.exports = { authorizeUserUpdate, getRolePermissions, protect, getTokenFromRequest, requirePermission };
