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

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
      return apiResponse(res, 400, 'Email and password are required');
    }

    const emailQuery = email.trim().toLowerCase();

    // 1. Check CommitteeMember collection first for Committee Member Login
    const committeeMember = await CommitteeMember.findOne({ email: emailQuery }).select('+password').populate('role_id');

    if (committeeMember && committeeMember.password) {
      const isMatch = await bcrypt.compare(password, committeeMember.password);
      if (isMatch) {
        if (committeeMember.status === 0) {
          return apiResponse(res, 403, 'Access denied: Your account is inactive.');
        }
        if (committeeMember.role_id && committeeMember.role_id.status === 0) {
          return apiResponse(res, 403, 'Access denied: Your assigned role is inactive.');
        }

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
    // Get the correct connection — tenant-specific or auto-lookup from registry by email
    const { tenantContext } = require('../utils/tenantContext');
    const { getTenantConnection, getRegistryConnection } = require('../config/registryDb');
    const store = tenantContext.getStore();
    let UserModel;
    let targetTenantSlug = null;

    // Pre-check tenant status in registry to block suspended login
    try {
      const registryConn = await getRegistryConnection();
      const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', require('../models/tenantSchema'));
      const tenantIdHeader = req.headers['x-tenant-id']?.toLowerCase();
      let checkTenant = null;
      if (tenantIdHeader) {
        checkTenant = await Tenant.findOne({ slug: tenantIdHeader });
      } else {
        checkTenant = await Tenant.findOne({ 'admin.email': emailQuery });
      }

      if (checkTenant && checkTenant.status === 0) {
        return apiResponse(res, 403, 'Access denied: Your Parivar community account has been suspended.');
      }
    } catch (err) {
      console.error('[loginAdmin] Tenant status check failed:', err);
    }

    if (store?.tenantConn) {
      // Use directly from tenant connection passed via header
      const tenantConn = store.tenantConn;
      UserModel = tenantConn.models.User || tenantConn.model('User', User.schema);
    } else {
      // Auto-detect Tenant from Registry by Admin Email
      try {
        const registryConn = await getRegistryConnection();
        const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', require('../models/tenantSchema'));
        const tenant = await Tenant.findOne({ 'admin.email': emailQuery });
        if (tenant) {
          if (tenant.status === 0) {
            return apiResponse(res, 403, 'Access denied: Your Parivar community account has been suspended.');
          }
          const tenantConn = await getTenantConnection(tenant.db_name);
          UserModel = tenantConn.models.User || tenantConn.model('User', User.schema);
          targetTenantSlug = tenant.slug;
        } else {
          UserModel = User;
        }
      } catch (err) {
        UserModel = User;
      }
    }
    
    const user = await UserModel.findOne({ email: emailQuery }).populate('role_id');

    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        if (user.status === 0) {
          return apiResponse(res, 403, 'Access denied: Your account is inactive.');
        }
        if (user.role_id && user.role_id.status === 0) {
          return apiResponse(res, 403, 'Access denied: Your assigned role is inactive.');
        }

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
          is_super_admin: user.is_committee || user.relation === 'Self',
          tenant_code: targetTenantSlug || req.headers['x-tenant-id'] || ''
        };

        return apiResponse(res, 200, 'Login successful', {
          token,
          user: userData,
          tenant_code: targetTenantSlug || req.headers['x-tenant-id'] || ''
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
    const { membersRange = 'last_6_months', activityRange = 'last_6_months', businessRange = 'last_6_months' } = req.query;
    const Event = require('../models/eventModel');

    // ── Tenant-aware model resolution ──
    const conn = req.tenantConn || null;
    const getModel = (ProxyModel, modelName) => {
      if (conn) {
        return conn.models[modelName] || conn.model(modelName, ProxyModel.schema);
      }
      return ProxyModel;
    };
    const TUser     = getModel(User,     'User');
    const TBusiness = getModel(Business, 'Business');
    const TPost     = getModel(Post,     'Post');
    const TEvent    = getModel(Event,    'Event');
    
    const today = new Date();
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const [
      userCount, businessCount, postCount, eventCount, committeeCount,
      lastMonthUsers, lastMonthBusinesses, lastMonthPosts, lastMonthEvents,
      thisMonthUsers, thisMonthBusinesses, thisMonthPosts, thisMonthEvents,
      recentMembers, recentEvents, recentPosts
    ] = await Promise.all([
      TUser.countDocuments({}),
      TBusiness.countDocuments({}),
      TPost.countDocuments({}),
      TEvent.countDocuments({}),
      TUser.countDocuments({ is_committee: true }),
      TUser.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
      TBusiness.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
      TPost.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
      TEvent.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
      TUser.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
      TBusiness.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
      TPost.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
      TEvent.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
      TUser.find({}).sort({ createdAt: -1 }).limit(5).select('first_name last_name email status image createdAt'),
      TEvent.find({}).sort({ createdAt: -1 }).limit(5).select('title start_time entry_type status image createdAt'),
      TPost.find({}).sort({ createdAt: -1 }).limit(5).select('title status image createdAt')
    ]);

    // Calculate percentage changes (This Month vs Last Month)
    const calcGrowth = (current, last) => {
      if (last === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - last) / last) * 100);
    };
    
    const usersGrowth = calcGrowth(thisMonthUsers, lastMonthUsers);
    const businessGrowth = calcGrowth(thisMonthBusinesses, lastMonthBusinesses);
    const postsGrowth = calcGrowth(thisMonthPosts, lastMonthPosts);
    const eventsGrowth = calcGrowth(thisMonthEvents, lastMonthEvents);

    const getStartDate = (range) => {
      const d = new Date();
      if (range === 'last_1_month') return new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
      if (range === 'last_3_months') return new Date(d.getFullYear(), d.getMonth() - 3, d.getDate());
      if (range === 'last_6_months') return new Date(d.getFullYear(), d.getMonth() - 6, d.getDate());
      if (range === 'this_year') return new Date(d.getFullYear(), 0, 1);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    };

    const bizStartDate = getStartDate(businessRange);

    // Business Categories Dynamic Aggregation with Lookup
    const businessCategoryCounts = await TBusiness.aggregate([
      { $match: { createdAt: { $gte: bizStartDate } } },
      { 
        $addFields: { 
          convertedCategoryId: { $toObjectId: "$business_category_id" } 
        } 
      },
      {
        $lookup: {
          from: 'businesscategories',
          localField: 'convertedCategoryId',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true }
      },
      { 
        $group: { 
          _id: "$business_category_id", 
          name: { $first: "$categoryDetails.name" },
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } },
      { $sort: { count: -1 } }
    ]);

    const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6'];
    const businessCategoriesChart = businessCategoryCounts.map((item, index) => ({
      name: item.name || 'Other',
      value: item.count,
      color: COLORS[index % COLORS.length]
    }));

    // Dynamic Chart Buckets Generator
    const getBuckets = (range) => {
      const buckets = [];
      const now = new Date();
      if (range === 'last_1_month') {
        for (let i = 3; i >= 0; i--) {
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7));
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((i + 1) * 7));
          buckets.push({ name: `W${4 - i}`, start, end });
        }
      } else if (range === 'last_3_months') {
        for (let i = 2; i >= 0; i--) {
          const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          buckets.push({ name: start.toLocaleString('default', { month: 'short' }), start, end });
        }
      } else if (range === 'this_year') {
        const currentMonth = now.getMonth();
        for (let i = 0; i <= currentMonth; i++) {
          const start = new Date(now.getFullYear(), i, 1);
          const end = new Date(now.getFullYear(), i + 1, 1);
          buckets.push({ name: start.toLocaleString('default', { month: 'short' }), start, end });
        }
      } else { // default 'last_6_months'
        for (let i = 5; i >= 0; i--) {
          const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          buckets.push({ name: start.toLocaleString('default', { month: 'short' }), start, end });
        }
      }
      return buckets;
    };

    const getMonthCount = async (Model, start, end) => {
      return await Model.countDocuments({ createdAt: { $gte: start, $lt: end } });
    };

    // Build Members Overview Chart
    const membersBuckets = getBuckets(membersRange);
    const membersChart = [];
    const membersQueries = membersBuckets.map(b => getMonthCount(TUser, b.start, b.end));
    const membersResults = await Promise.all(membersQueries);
    membersBuckets.forEach((b, index) => {
      membersChart.push({ name: b.name, members: membersResults[index] });
    });

    // Build Activity Summary Chart
    const activityBuckets = getBuckets(activityRange);
    const activityChart = [];
    const activityQueries = [];
    activityBuckets.forEach(b => {
      activityQueries.push(Promise.all([
        getMonthCount(TUser, b.start, b.end),
        getMonthCount(TBusiness, b.start, b.end),
        getMonthCount(TPost, b.start, b.end),
        getMonthCount(TEvent, b.start, b.end)
      ]));
    });
    
    const activityResults = await Promise.all(activityQueries);
    let totalActivityPosts = 0;
    let totalActivityMembers = 0;
    let totalActivityBusinesses = 0;
    let totalActivityEvents = 0;

    activityBuckets.forEach((b, index) => {
      const [uCount, bCount, pCount, eCount] = activityResults[index];
      activityChart.push({
        name: b.name,
        posts: pCount,
        events: eCount, 
        members: uCount,
        businesses: bCount
      });
      totalActivityPosts += pCount;
      totalActivityMembers += uCount;
      totalActivityBusinesses += bCount;
      totalActivityEvents += eCount;
    });

    // Build Recent Activity Feed (Using Recent Events instead of Recent Businesses per instruction)
    const combinedActivity = [
      ...recentMembers.map(m => ({
        id: m._id,
        title: `${m.first_name} ${m.last_name || ''} joined the family directory`,
        time: m.createdAt,
        type: 'member',
        icon: 'user'
      })),
      ...recentEvents.map(e => ({
        id: e._id,
        title: `Event "${e.title}" was created`,
        time: e.createdAt,
        type: 'business', // keeping same color style
        icon: 'calendar'
      })),
      ...recentPosts.map(p => ({
        id: p._id,
        title: `${p.title} published on community board`,
        time: p.createdAt,
        type: 'post',
        icon: 'file-text'
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);
    
    return apiResponse(res, 200, 'Dashboard statistics fetched successfully', {
      kpis: {
        users: { total: userCount, growth: usersGrowth },
        businesses: { total: businessCount, growth: businessGrowth },
        posts: { total: postCount, growth: postsGrowth },
        events: { total: eventCount, growth: eventsGrowth } 
      },
      charts: {
        members: membersChart,
        businessCategories: businessCategoriesChart,
        activity: activityChart
      },
      activitySummaryTotals: {
         posts: { total: totalActivityPosts, growth: postsGrowth },
         events: { total: totalActivityEvents, growth: eventsGrowth },
         members: { total: totalActivityMembers, growth: usersGrowth },
         businesses: { total: totalActivityBusinesses, growth: businessGrowth }
      },
      tables: {
        recentMembers: recentMembers.map(m => ({
          _id: m._id,
          name: `${m.first_name} ${m.last_name || ''}`,
          email: m.email,
          status: m.status === 1 ? 'Approved' : 'Pending',
          image: m.image
        })),
        recentEvents: recentEvents.map(e => ({
          _id: e._id,
          title: e.title,
          date: e.start_time,
          type: e.entry_type || 'Free',
          status: e.status === 1 ? 'Active' : 'Inactive',
          image: e.image
        })),
        recentPosts: recentPosts.map(p => ({
          _id: p._id,
          title: p.title,
          date: p.createdAt,
          status: p.status === 1 ? 'Published' : 'Draft',
          image: p.image
        }))
      },
      recentActivity: combinedActivity,
      atAGlance: {
        activeMembers: userCount,
        activeBusinesses: businessCount,
        postsThisMonth: thisMonthPosts, 
        upcomingEvents: 0
      }
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error in getting stats', { error: error.message });
  }
};



// Change password for logged in admin
const changePassword = async (req, res) => {
  try {
    const { new_password, confirm_password } = req.body;

    if (!new_password) {
      return apiResponse(res, 400, 'New password is required');
    }

    if (confirm_password && new_password !== confirm_password) {
      return apiResponse(res, 400, 'Passwords do not match');
    }

    if (new_password.length < 5) {
      return apiResponse(res, 400, 'Password must be at least 5 characters');
    }

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return apiResponse(res, 401, 'Unauthorized: User not found in request');
    }

    const conn = req.tenantConn || null;
    let UserModel;
    if (conn) {
      UserModel = conn.models.User || conn.model('User', User.schema);
    } else {
      UserModel = User;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      // Check committee member
      let CMModel = conn ? (conn.models.CommitteeMember || conn.model('CommitteeMember', CommitteeMember.schema)) : CommitteeMember;
      const cm = await CMModel.findById(userId);
      if (!cm) {
        return apiResponse(res, 404, 'Admin user not found');
      }
      cm.password = new_password;
      await cm.save();
      return apiResponse(res, 200, 'Password updated successfully');
    }

    user.password = new_password;
    await user.save();

    return apiResponse(res, 200, 'Password updated successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error updating password', { error: error.message });
  }
};

module.exports = {
  createAdmin,
  loginAdmin,
  updateAdminRecovery,
  getStats,
  changePassword

};
