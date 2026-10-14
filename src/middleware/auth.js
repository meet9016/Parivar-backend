const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/userModels');
const CommitteeMember = require('../models/committeeMemberModel');
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

const { tenantContext } = require('../utils/tenantContext');

const getActiveUserModel = (req) => {
  const conn = req?.tenantConn || (tenantContext.getStore()?.tenantConn);
  if (conn) {
    return conn.models.User || conn.model('User', User.schema);
  }
  return User;
};

const getActiveCommitteeModel = (req) => {
  const conn = req?.tenantConn || (tenantContext.getStore()?.tenantConn);
  if (conn) {
    return conn.models.CommitteeMember || conn.model('CommitteeMember', CommitteeMember.schema);
  }
  return CommitteeMember;
};

const normalizeAuthUser = async (conn, rawUser, isCommittee = false) => {
  if (!rawUser) return null;
  const userObj = rawUser.toObject ? rawUser.toObject() : { ...rawUser };
  const UserModel = conn.models.User || conn.model('User', User.schema);
  const Master = conn.models.Master || conn.model('Master', require('../models/masterModel').schema);

  if (isCommittee) {
    userObj.is_committee = true;
    if (userObj.number) {
      try {
        const linkedUser = await UserModel.findOne({ number: userObj.number }).lean();
        if (linkedUser) {
          if (!userObj.village && (linkedUser.village || linkedUser.village_name)) {
            userObj.village = linkedUser.village || linkedUser.village_name || '';
            userObj.village_id = linkedUser.village_id || '';
          }
          if (!userObj.city_id && linkedUser.city_id) userObj.city_id = linkedUser.city_id;
          if (!userObj.city && (linkedUser.city || linkedUser.city_name)) userObj.city = linkedUser.city || linkedUser.city_name || '';
          if (!userObj.district_id && linkedUser.district_id) userObj.district_id = linkedUser.district_id;
          if (!userObj.district && (linkedUser.district || linkedUser.district_name)) userObj.district = linkedUser.district || linkedUser.district_name || '';
          if (!userObj.state_id && linkedUser.state_id) userObj.state_id = linkedUser.state_id;
          if (!userObj.state && (linkedUser.state || linkedUser.state_name)) userObj.state = linkedUser.state || linkedUser.state_name || '';
        }
      } catch (_) {}
    }
  }

  // Resolve village if it's an ObjectId or missing name
  if (userObj.village && /^[0-9a-fA-F]{24}$/.test(String(userObj.village).trim())) {
    try {
      const vDoc = await Master.findById(userObj.village).lean();
      if (vDoc?.name) {
        userObj.village_id = userObj.village;
        userObj.village = vDoc.name;
        userObj.village_name = vDoc.name;
      }
    } catch (_) {}
  } else if (!userObj.village && userObj.village_id && /^[0-9a-fA-F]{24}$/.test(String(userObj.village_id).trim())) {
    try {
      const vDoc = await Master.findById(userObj.village_id).lean();
      if (vDoc?.name) {
        userObj.village = vDoc.name;
        userObj.village_name = vDoc.name;
      }
    } catch (_) {}
  }

  // Resolve state if state is an ObjectId or missing name
  if (userObj.state && /^[0-9a-fA-F]{24}$/.test(String(userObj.state).trim())) {
    try {
      const sDoc = await Master.findById(userObj.state).lean();
      if (sDoc?.name) {
        userObj.state_id = userObj.state;
        userObj.state = sDoc.name;
      }
    } catch (_) {}
  } else if (!userObj.state && userObj.state_id && /^[0-9a-fA-F]{24}$/.test(String(userObj.state_id).trim())) {
    try {
      const sDoc = await Master.findById(userObj.state_id).lean();
      if (sDoc?.name) userObj.state = sDoc.name;
    } catch (_) {}
  }

  // Resolve district if district is an ObjectId or missing name
  if (userObj.district && /^[0-9a-fA-F]{24}$/.test(String(userObj.district).trim())) {
    try {
      const dDoc = await Master.findById(userObj.district).lean();
      if (dDoc?.name) {
        userObj.district_id = userObj.district;
        userObj.district = dDoc.name;
      }
    } catch (_) {}
  } else if (!userObj.district && userObj.district_id && /^[0-9a-fA-F]{24}$/.test(String(userObj.district_id).trim())) {
    try {
      const dDoc = await Master.findById(userObj.district_id).lean();
      if (dDoc?.name) userObj.district = dDoc.name;
    } catch (_) {}
  }

  // Resolve city if city is an ObjectId or missing name
  if (userObj.city && /^[0-9a-fA-F]{24}$/.test(String(userObj.city).trim())) {
    try {
      const cDoc = await Master.findById(userObj.city).lean();
      if (cDoc?.name) {
        userObj.city_id = userObj.city;
        userObj.city = cDoc.name;
      }
    } catch (_) {}
  } else if (!userObj.city && userObj.city_id && /^[0-9a-fA-F]{24}$/.test(String(userObj.city_id).trim())) {
    try {
      const cDoc = await Master.findById(userObj.city_id).lean();
      if (cDoc?.name) userObj.city = cDoc.name;
    } catch (_) {}
  }

  return userObj;
};

const findUserInConnection = async (conn, decoded) => {
  if (!conn) return null;
  const UserModel = conn.models.User || conn.model('User', User.schema);
  const CMModel = conn.models.CommitteeMember || conn.model('CommitteeMember', CommitteeMember.schema);
  const userId = decoded.id || decoded._id || decoded.userId;

  if (userId && mongoose.isValidObjectId(userId)) {
    const user = await UserModel.findById(userId).select('-password').populate('role_id');
    if (user) return await normalizeAuthUser(conn, user, false);

    const committeeMember = await CMModel.findById(userId).select('-password').populate('role_id');
    if (committeeMember) return await normalizeAuthUser(conn, committeeMember, true);
  }

  if (userId) {
    const user = await UserModel.findOne({ member_id: String(userId) }).select('-password').populate('role_id');
    if (user) return await normalizeAuthUser(conn, user, false);
  }

  if (decoded.member_id) {
    const user = await UserModel.findOne({ member_id: String(decoded.member_id) }).select('-password').populate('role_id');
    if (user) return await normalizeAuthUser(conn, user, false);
  }

  if (decoded.number) {
    const user = await UserModel.findOne({ number: String(decoded.number) }).select('-password').populate('role_id');
    if (user) return await normalizeAuthUser(conn, user, false);
    const committeeMember = await CMModel.findOne({ number: String(decoded.number) }).select('-password').populate('role_id');
    if (committeeMember) return await normalizeAuthUser(conn, committeeMember, true);
  }

  return null;
};

const findUserFromToken = async (decoded, req) => {
  const activeConn = req?.tenantConn || (tenantContext.getStore()?.tenantConn);
  
  // 1. Try in current active tenant connection
  if (activeConn) {
    const user = await findUserInConnection(activeConn, decoded);
    if (user) return user;
  }

  // 2. If token contains tenant_code and it is different, try that tenant connection
  if (decoded.tenant_code) {
    try {
      const { getTenantConnection } = require('../config/registryDb');
      const dbName = decoded.tenant_code.startsWith('parivar_') ? decoded.tenant_code : `parivar_${decoded.tenant_code}`;
      const tokenTenantConn = await getTenantConnection(dbName);
      if (tokenTenantConn && tokenTenantConn !== activeConn) {
        const user = await findUserInConnection(tokenTenantConn, decoded);
        if (user) return user;
      }
    } catch (_) {}
  }

  // 3. Fallback to Primary DB connection
  if (mongoose.connection && mongoose.connection !== activeConn) {
    const user = await findUserInConnection(mongoose.connection, decoded);
    if (user) return user;
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
    req.user = await findUserFromToken(decoded, req);

    if (!req.user) {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized: Invalid or expired token',
        data: []
      });
    }

    if (req.user.role_id && req.user.role_id.status === 0) {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized: Your role has been deactivated. Please contact support.',
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
  const roleName = user.role_id?.name?.toLowerCase() || user.role_id?.roleName?.toLowerCase() || String(user.role || '').toLowerCase();
  if (roleName === 'admin' || roleName === 'super admin' || user.role === 'superadmin' || user.committee_role === 'President' || user.is_super_admin === true || (user.is_committee === true && (!user.role_id || user.committee_role === 'Admin'))) {
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

const isAdminUser = (user = {}) => {
  const roleName = user?.role_id?.name?.toLowerCase() || user?.role_id?.roleName?.toLowerCase() || String(user?.role || '').toLowerCase();
  return (
    user.role === 'admin'
    || roleName === 'admin'
    || user.committee_role === 'President'
    || getRolePermissions(user).includes('members.edit')
  );
};

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
    'registrations.': 'members.list',
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
    'dashboard.view': 'dashboard.view',
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
  if (!req.user) {
    return res.status(401).json({
      status: 401,
      message: 'Unauthorized: User not authenticated',
      data: []
    });
  }

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
