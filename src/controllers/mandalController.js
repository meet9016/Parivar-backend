const Mandal = require('../models/mandalModel');
const MandalContribution = require('../models/mandalContributionModel');
const MandalExpense = require('../models/mandalExpenseModel');
const User = require('../models/userModels');
const { apiResponse } = require('../utils/apiResponse');
const { uploadToExternalService } = require('../utils/fileUpload');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { createAndBroadcast } = require('./notificationController');
const { generatePdfFromHtml } = require('../services/pdfService');
const { renderContributionReceiptHtml } = require('../templates/mandalContributionReceiptTemplateService');

function resolveBaseUrl(req) {
  let base = process.env.BASE_URL;
  if (base) return base.replace(/\/api\/?$/, '').replace(/\/$/, '');

  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
    base = `${protocol}://${host}`;
  } else {
    base = 'http://localhost:5000';
  }
  return base.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

function buildContributionDownloadUrl(recId, req) {
  const baseUrl = resolveBaseUrl(req);
  const token = req?.query?.token || '';
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

  const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host') || '';
  const referer = req?.headers?.['referer'] || '';
  const isApiApi = (req?.originalUrl && req.originalUrl.includes('/api/api')) ||
                    host.includes('parivar.me') ||
                    referer.includes('parivar.me');

  const prefix = isApiApi ? '/api/api' : '/api';
  return `${baseUrl}${prefix}/mandal/contributions/receipt/${recId}/download${tokenQuery}`;
}

// Helper to resolve mandal by ID or fallback to default
async function resolveMandal(mandalId) {
  if (mandalId && mongoose.isValidObjectId(mandalId)) {
    const found = await Mandal.findById(mandalId);
    if (found) return found;
  }
  let mandal = await Mandal.findOne({ status: 1 });
  if (!mandal) {
    mandal = await Mandal.findOne();
  }
  if (!mandal) {
    mandal = await Mandal.create({
      name: 'Shree Parivar Yuvak Mandal',
      monthly_amount: 500,
      start_date: new Date(),
      status: 1,
      members: []
    });
  }
  return mandal;
}

// Helper to determine if the logged-in user is an admin / superadmin
function isMandalAdminUser(user) {
  if (!user) return false;
  if (user.is_super_admin === true) return true;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  if (user.committee_role === 'President' || user.committee_role === 'Admin') return true;
  const roleName = user.role_id?.name?.toLowerCase() || user.role_id?.roleName?.toLowerCase() || String(user.role || '').toLowerCase();
  if (roleName === 'admin' || roleName === 'super admin' || roleName === 'superadmin') return true;
  if (user.is_committee === true && !user.role_id) return true;

  const perms = Array.isArray(user.role_id?.permissions) ? user.role_id.permissions : [];
  if (perms.includes('*') || perms.includes('all') || perms.includes('committee.manage')) return true;

  return false;
}

// 1. List All Mandals (Multiple Mandals)
exports.getMandalsList = async (req, res) => {
  try {
    const isFullAdmin = isMandalAdminUser(req.user);
    const userId = req.user ? (req.user._id || req.user.id) : null;

    let query = {};
    if (!isFullAdmin && userId) {
      // Regular user: Only show the mandal(s) where they are enrolled as member
      query = { members: userId };
    }

    const mandals = await Mandal.find(query)
      .populate('mandal_head_id', 'first_name middle_name last_name number profile_image image')
      .sort({ createdAt: -1 })
      .lean();

    if (mandals.length === 0) {
      if (!isFullAdmin) {
        return apiResponse(res, 200, 'User is not enrolled in any Mandal', []);
      }
      const def = await resolveMandal();
      return apiResponse(res, 200, 'Mandals list retrieved successfully', [{
        ...def.toObject(),
        id: def._id,
        members_count: (def.members || []).length
      }]);
    }

    const formatted = mandals.map(m => {
      if (!isFullAdmin && userId) {
        return {
          ...m,
          id: m._id,
          members: [userId],
          members_count: 1
        };
      }
      return {
        ...m,
        id: m._id,
        members_count: (m.members || []).length
      };
    });

    return apiResponse(res, 200, 'Mandals list retrieved successfully', formatted);
  } catch (error) {
    console.error('Error in getMandalsList:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch mandals list');
  }
};

// 2. Create New Mandal
exports.createMandal = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const { name, monthly_amount, due_day, start_date, mandal_head_id, status, description, rules } = req.body;

    if (!name || !name.trim()) {
      return apiResponse(res, 400, 'Mandal name is required');
    }

    let headName = '';
    if (mandal_head_id && mongoose.isValidObjectId(mandal_head_id)) {
      const headUser = await User.findById(mandal_head_id);
      if (headUser) {
        headName = `${headUser.first_name || ''} ${headUser.middle_name || ''} ${headUser.last_name || ''}`.trim();
      }
    }

    const newMandal = await Mandal.create({
      name: name.trim(),
      monthly_amount: monthly_amount !== undefined ? Number(monthly_amount) : 500,
      due_day: due_day !== undefined ? Number(due_day) : 10,
      start_date: start_date ? new Date(start_date) : new Date(),
      mandal_head_id: mandal_head_id || null,
      mandal_head_name: headName,
      status: status !== undefined ? Number(status) : 1,
      description: description || '',
      rules: rules || '',
      members: []
    });

    return apiResponse(res, 201, 'Mandal created successfully', newMandal);
  } catch (error) {
    console.error('Error in createMandal:', error);
    return apiResponse(res, 500, error.message || 'Failed to create mandal');
  }
};

// 3. Get Single Mandal Setup / Details
exports.getMandalSetup = async (req, res) => {
  try {
    const mandalId = req.query.mandal_id || req.params.id;
    const mandal = await resolveMandal(mandalId);
    await mandal.populate([
      { path: 'mandal_head_id', select: 'first_name middle_name last_name number profile_image image' }
    ]);
    return apiResponse(res, 200, 'Mandal details fetched successfully', mandal);
  } catch (error) {
    console.error('Error in getMandalSetup:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch mandal setup');
  }
};

// 4. Update Mandal Setup
exports.updateMandalSetup = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const mandalId = req.query.mandal_id || req.params.id || req.body.mandal_id;
    const mandal = await resolveMandal(mandalId);
    const { name, monthly_amount, due_day, start_date, mandal_head_id, status, description, rules } = req.body;

    if (name !== undefined) mandal.name = name;
    if (monthly_amount !== undefined) mandal.monthly_amount = Number(monthly_amount);
    if (due_day !== undefined) mandal.due_day = Number(due_day);
    if (start_date !== undefined) mandal.start_date = new Date(start_date);
    if (status !== undefined) mandal.status = Number(status);
    if (description !== undefined) mandal.description = description;
    if (rules !== undefined) mandal.rules = rules;

    if (mandal_head_id) {
      mandal.mandal_head_id = mandal_head_id;
      const headUser = await User.findById(mandal_head_id);
      if (headUser) {
        mandal.mandal_head_name = `${headUser.first_name || ''} ${headUser.middle_name || ''} ${headUser.last_name || ''}`.trim();
      }
    } else if (mandal_head_id === null || mandal_head_id === '') {
      mandal.mandal_head_id = null;
      mandal.mandal_head_name = '';
    }

    await mandal.save();
    return apiResponse(res, 200, 'Mandal setup updated successfully', mandal);
  } catch (error) {
    console.error('Error in updateMandalSetup:', error);
    return apiResponse(res, 500, error.message || 'Failed to update mandal setup');
  }
};

// 5. Delete Mandal
exports.deleteMandal = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const mandalId = req.params.id || req.body.mandal_id;
    if (!mandalId) {
      return apiResponse(res, 400, 'Mandal ID is required');
    }

    const count = await Mandal.countDocuments();
    if (count <= 1) {
      return apiResponse(res, 400, 'Cannot delete the only remaining Mandal. Create another Mandal first.');
    }

    await Mandal.findByIdAndDelete(mandalId);
    await MandalContribution.deleteMany({ mandal_id: mandalId });
    await MandalExpense.deleteMany({ mandal_id: mandalId });

    return apiResponse(res, 200, 'Mandal deleted successfully');
  } catch (error) {
    console.error('Error in deleteMandal:', error);
    return apiResponse(res, 500, error.message || 'Failed to delete mandal');
  }
};

// 6. Get Members for Mandal Selection / Management
exports.getMandalMembers = async (req, res) => {
  try {
    const isFullAdmin = isMandalAdminUser(req.user);
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const mandal = await resolveMandal(req.query.mandal_id);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const search = (req.query.search || '').trim();
    const filterType = req.query.filter_type || 'all'; // 'all', 'mandal_only', 'non_mandal'

    const mandalMemberIds = (mandal.members || []).map(id => id.toString());

    let query = {};
    if (!isFullAdmin && userId) {
      const isEnrolled = mandalMemberIds.includes(userId.toString());
      if (!isEnrolled) {
        return apiResponse(res, 200, 'User is not enrolled in this Mandal', {
          data: [],
          total_mandal_members: 0,
          pagination: {
            page: 1,
            limit,
            total: 0,
            totalPages: 1
          }
        });
      }
      // Regular user only sees themselves
      query._id = userId;
    } else if (filterType === 'mandal_only') {
      query._id = { $in: mandal.members || [] };
    } else if (filterType === 'non_mandal') {
      query._id = { $nin: mandal.members || [] };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { first_name: searchRegex },
        { middle_name: searchRegex },
        { last_name: searchRegex },
        { number: searchRegex },
        { village: searchRegex }
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('first_name middle_name last_name number member_id village village_id address city_id image profile_image gender status')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const formatted = users.map(user => ({
      ...user,
      id: user._id,
      is_mandal_member: mandalMemberIds.includes(user._id.toString()),
      name: `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.trim(),
      full_name: `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.trim(),
      mobile: user.number || '',
      phone: user.number || '',
      village_name: user.village || user.village_id || user.address || ''
    }));

    return apiResponse(res, 200, 'Members fetched successfully', {
      data: formatted,
      total_mandal_members: isFullAdmin ? mandalMemberIds.length : (mandalMemberIds.includes(userId?.toString()) ? 1 : 0),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Error in getMandalMembers:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch mandal members');
  }
};

// 7. Toggle single member in Mandal
exports.toggleMandalMember = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const { member_id, mandal_id } = req.body;
    if (!member_id) {
      return apiResponse(res, 400, 'Member ID is required');
    }

    const mandal = await resolveMandal(mandal_id);
    const memberObjId = new mongoose.Types.ObjectId(member_id);
    const existingIndex = (mandal.members || []).findIndex(id => id.toString() === member_id.toString());

    let isAdded = false;
    if (existingIndex > -1) {
      mandal.members.splice(existingIndex, 1);
      isAdded = false;
    } else {
      mandal.members.push(memberObjId);
      isAdded = true;
    }

    await mandal.save();
    return apiResponse(res, 200, isAdded ? 'Member enrolled in Mandal' : 'Member removed from Mandal', {
      is_mandal_member: isAdded,
      total_mandal_members: mandal.members.length
    });
  } catch (error) {
    console.error('Error in toggleMandalMember:', error);
    return apiResponse(res, 500, error.message || 'Failed to update member mandal status');
  }
};

// 8. Bulk update members in Mandal
exports.bulkUpdateMandalMembers = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const { member_ids, action, mandal_id } = req.body; // action: 'add', 'remove', or 'enroll_all'

    const mandal = await resolveMandal(mandal_id);

    if (action === 'enroll_all') {
      const allUsers = await User.find({}).select('_id').lean();
      mandal.members = allUsers.map(u => u._id);
      await mandal.save();
      return apiResponse(res, 200, `Successfully enrolled all ${mandal.members.length} members into Mandal`, {
        total_mandal_members: mandal.members.length
      });
    }

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return apiResponse(res, 400, 'member_ids array is required');
    }

    const currentMemberSet = new Set((mandal.members || []).map(id => id.toString()));

    if (action === 'add') {
      member_ids.forEach(id => currentMemberSet.add(id.toString()));
    } else if (action === 'remove') {
      member_ids.forEach(id => currentMemberSet.delete(id.toString()));
    }

    mandal.members = Array.from(currentMemberSet).map(id => new mongoose.Types.ObjectId(id));
    await mandal.save();

    return apiResponse(res, 200, `Successfully ${action === 'add' ? 'enrolled' : 'removed'} ${member_ids.length} members`, {
      total_mandal_members: mandal.members.length
    });
  } catch (error) {
    console.error('Error in bulkUpdateMandalMembers:', error);
    return apiResponse(res, 500, error.message || 'Failed to bulk update mandal members');
  }
};

// 9. Get Month-wise Contributions (Auto-generates pending records for enrolled members)
exports.getMonthlyContributions = async (req, res) => {
  try {
    const isFullAdmin = isMandalAdminUser(req.user);
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const mandal = await resolveMandal(req.query.mandal_id);
    const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const month = req.query.month || currentMonthStr;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const statusFilter = req.query.status || 'All'; // 'All', 'Paid', 'Pending'
    const search = (req.query.search || '').trim();

    const mandalMemberIds = mandal.members || [];

    // If regular user: check if enrolled in this mandal
    if (!isFullAdmin && userId) {
      const isEnrolled = mandalMemberIds.some(id => id.toString() === userId.toString());
      if (!isEnrolled) {
        return apiResponse(res, 200, 'User is not enrolled in this Mandal', {
          data: [],
          summary: {
            month,
            mandal_monthly_amount: mandal.monthly_amount || 500,
            total_members: 0,
            paid_members: 0,
            pending_members: 0,
            expected_amount: 0,
            collected_amount: 0,
            pending_amount: 0,
            cash_collected: 0,
            bank_online_collected: 0,
            grand_total_collected: 0,
            grand_cash_collected: 0,
            grand_bank_online_collected: 0,
            mandals_breakdown: []
          },
          pagination: {
            page: 1,
            limit,
            total: 0,
            totalPages: 1
          }
        });
      }
    }

    // Ensure all mandal members have a contribution record for this month
    if (mandalMemberIds.length > 0) {
      const existingContribs = await MandalContribution.find({
        mandal_id: mandal._id,
        month: month
      }).select('member_id').lean();

      const existingMemberIdSet = new Set(existingContribs.map(c => c.member_id.toString()));
      const missingMemberIds = mandalMemberIds.filter(id => !existingMemberIdSet.has(id.toString()));

      if (missingMemberIds.length > 0) {
        const missingUsers = await User.find({ _id: { $in: missingMemberIds } })
          .select('first_name middle_name last_name number village image profile_image')
          .lean();

        const newRecords = missingUsers.map(user => ({
          mandal_id: mandal._id,
          member_id: user._id,
          member_name: `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.trim(),
          member_number: user.number || '',
          month: month,
          amount: 0,
          expected_amount: mandal.monthly_amount || 500,
          status: 'Pending',
          payment_mode: 'Cash'
        }));

        if (newRecords.length > 0) {
          await MandalContribution.insertMany(newRecords, { ordered: false }).catch(() => {});
        }
      }
    }

    // Build query for month
    let query = {
      mandal_id: mandal._id,
      month: month,
      member_id: { $in: mandalMemberIds }
    };

    // If regular user: MUST ONLY SEE THEIR OWN RECORD!
    if (!isFullAdmin && userId) {
      query.member_id = userId;
    }

    if (statusFilter && statusFilter !== 'All') {
      query.status = statusFilter;
    }

    if (req.query.payment_mode && req.query.payment_mode !== 'All') {
      query.payment_mode = req.query.payment_mode;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { member_name: searchRegex },
        { member_number: searchRegex },
        { receipt_number: searchRegex },
        { transaction_id: searchRegex }
      ];
    }

    const total = await MandalContribution.countDocuments(query);
    const contributions = await MandalContribution.find(query)
      .populate('member_id', 'first_name middle_name last_name number image profile_image village')
      .sort({ status: 1, member_name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Summary calculation for the given month
    let summaryPayload = {};

    if (!isFullAdmin && userId) {
      // Summary ONLY for this user
      const myContrib = await MandalContribution.findOne({
        mandal_id: mandal._id,
        month: month,
        member_id: userId
      }).lean();

      const isPaid = myContrib?.status === 'Paid';
      const expAmt = Number(myContrib?.expected_amount || mandal.monthly_amount || 500);
      const paidAmt = isPaid ? Number(myContrib?.amount || expAmt) : 0;
      const pendAmt = isPaid ? 0 : expAmt;
      const mode = String(myContrib?.payment_mode || 'Cash').toLowerCase().trim();

      summaryPayload = {
        month,
        mandal_monthly_amount: mandal.monthly_amount || 500,
        total_members: 1,
        paid_members: isPaid ? 1 : 0,
        pending_members: isPaid ? 0 : 1,
        expected_amount: expAmt,
        collected_amount: paidAmt,
        pending_amount: pendAmt,
        cash_collected: mode === 'cash' ? paidAmt : 0,
        bank_online_collected: mode !== 'cash' ? paidAmt : 0,
        grand_total_collected: paidAmt,
        grand_cash_collected: mode === 'cash' ? paidAmt : 0,
        grand_bank_online_collected: mode !== 'cash' ? paidAmt : 0,
        mandals_breakdown: []
      };
    } else {
      // Admin summary (all members)
      const allMonthContribs = await MandalContribution.find({
        mandal_id: mandal._id,
        month: month,
        member_id: { $in: mandalMemberIds }
      }).lean();

      const totalMembers = mandalMemberIds.length;
      const paidList = allMonthContribs.filter(c => c.status === 'Paid');
      const paidMembersCount = paidList.length;
      const pendingMembersCount = Math.max(0, totalMembers - paidMembersCount);
      const collectedAmount = paidList.reduce((acc, c) => acc + (c.amount || 0), 0);
      const expectedAmount = totalMembers * (mandal.monthly_amount || 500);
      const pendingAmount = Math.max(0, expectedAmount - collectedAmount);

      let cashCollected = 0;
      let bankOnlineCollected = 0;
      paidList.forEach(c => {
        const mode = String(c.payment_mode || 'Cash').toLowerCase().trim();
        const amt = Number(c.amount || 0);
        if (mode === 'cash') {
          cashCollected += amt;
        } else {
          bankOnlineCollected += amt;
        }
      });

      // Grand Total across ALL Mandals for this month
      const allMandalsList = await Mandal.find().select('_id name monthly_amount').lean();
      const allMandalsPaidMonth = await MandalContribution.find({
        month: month,
        status: 'Paid'
      }).lean();

      let grandTotalCollected = 0;
      let grandCashCollected = 0;
      let grandBankOnlineCollected = 0;

      const mandalStatsMap = {};
      allMandalsList.forEach(m => {
        mandalStatsMap[m._id.toString()] = {
          mandal_id: m._id,
          name: m.name,
          monthly_amount: m.monthly_amount || 500,
          total_collected: 0,
          cash_collected: 0,
          bank_collected: 0
        };
      });

      allMandalsPaidMonth.forEach(c => {
        const mode = String(c.payment_mode || 'Cash').toLowerCase().trim();
        const amt = Number(c.amount || 0);
        const mId = c.mandal_id ? c.mandal_id.toString() : '';

        grandTotalCollected += amt;
        if (mode === 'cash') {
          grandCashCollected += amt;
        } else {
          grandBankOnlineCollected += amt;
        }

        if (mId && mandalStatsMap[mId]) {
          mandalStatsMap[mId].total_collected += amt;
          if (mode === 'cash') {
            mandalStatsMap[mId].cash_collected += amt;
          } else {
            mandalStatsMap[mId].bank_collected += amt;
          }
        }
      });

      summaryPayload = {
        month,
        mandal_monthly_amount: mandal.monthly_amount || 500,
        total_members: totalMembers,
        paid_members: paidMembersCount,
        pending_members: pendingMembersCount,
        expected_amount: expectedAmount,
        collected_amount: collectedAmount,
        pending_amount: pendingAmount,
        cash_collected: cashCollected,
        bank_online_collected: bankOnlineCollected,
        grand_total_collected: grandTotalCollected,
        grand_cash_collected: grandCashCollected,
        grand_bank_online_collected: grandBankOnlineCollected,
        mandals_breakdown: Object.values(mandalStatsMap)
      };
    }

    const formatted = contributions.map(c => {
      const recId = String(c._id || c.id);
      const downloadUrl = buildContributionDownloadUrl(recId, req);
      return {
        ...c,
        id: c._id,
        member_name: c.member_name || (c.member_id ? `${c.member_id.first_name || ''} ${c.member_id.last_name || ''}`.trim() : 'Unknown Member'),
        member_number: c.member_number || c.member_id?.number || '',
        download_url: downloadUrl,
        receipt_url: downloadUrl
      };
    });

    return apiResponse(res, 200, 'Monthly contributions fetched successfully', {
      data: formatted,
      summary: summaryPayload,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Error in getMonthlyContributions:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch monthly contributions');
  }
};

// 9b. Export Month-wise Contributions to Excel (.xlsx)
exports.exportMonthlyContributions = async (req, res) => {
  try {
    const isFullAdmin = isMandalAdminUser(req.user);
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const mandal = await resolveMandal(req.query.mandal_id);
    const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const month = req.query.month || currentMonthStr;
    const statusFilter = req.query.status || 'All';
    const paymentMode = req.query.payment_mode;
    const search = (req.query.search || '').trim();

    const mandalMemberIds = mandal.members || [];

    if (!isFullAdmin && userId) {
      const isEnrolled = mandalMemberIds.some(id => id.toString() === userId.toString());
      if (!isEnrolled) {
        return apiResponse(res, 403, 'User is not enrolled in this Mandal');
      }
    }

    // Ensure all mandal members have a contribution record for this month
    if (mandalMemberIds.length > 0) {
      const existingContribs = await MandalContribution.find({
        mandal_id: mandal._id,
        month: month
      }).select('member_id').lean();

      const existingMemberIdSet = new Set(existingContribs.map(c => c.member_id.toString()));
      const missingMemberIds = mandalMemberIds.filter(id => !existingMemberIdSet.has(id.toString()));

      if (missingMemberIds.length > 0) {
        const missingUsers = await User.find({ _id: { $in: missingMemberIds } })
          .select('first_name middle_name last_name number village image profile_image')
          .lean();

        const newRecords = missingUsers.map(user => ({
          mandal_id: mandal._id,
          member_id: user._id,
          member_name: `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.trim(),
          member_number: user.number || '',
          month: month,
          amount: 0,
          expected_amount: mandal.monthly_amount || 500,
          status: 'Pending',
          payment_mode: 'Cash'
        }));

        if (newRecords.length > 0) {
          await MandalContribution.insertMany(newRecords, { ordered: false }).catch(() => {});
        }
      }
    }

    // Build query for month
    let query = {
      mandal_id: mandal._id,
      month: month,
      member_id: { $in: mandalMemberIds }
    };

    if (!isFullAdmin && userId) {
      query.member_id = userId;
    }

    if (statusFilter && statusFilter !== 'All') {
      query.status = statusFilter;
    }

    if (paymentMode && paymentMode !== 'All') {
      query.payment_mode = paymentMode;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { member_name: searchRegex },
        { member_number: searchRegex },
        { receipt_number: searchRegex },
        { transaction_id: searchRegex }
      ];
    }

    if (req.query.ids) {
      const ids = String(req.query.ids).split(',').map(id => id.trim()).filter(id => mongoose.isValidObjectId(id));
      if (ids.length > 0) {
        query._id = { $in: ids };
      }
    }

    const contributions = await MandalContribution.find(query)
      .populate('member_id', 'first_name middle_name last_name number village')
      .sort({ status: 1, member_name: 1 })
      .lean();

    const excelRows = contributions.map((c, idx) => {
      const u = c.member_id || {};
      const fullName = c.member_name || `${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''}`.trim() || 'Unknown Member';
      const mobile = c.member_number || u.number || '';
      const pDate = c.payment_date ? new Date(c.payment_date).toISOString().slice(0, 10) : '';

      return {
        'Sr No': idx + 1,
        'Member Name': fullName,
        'Mobile Number': mobile,
        'Village': u.village || '',
        'Month': c.month || month,
        'Expected Amount (₹)': Number(c.expected_amount || mandal.monthly_amount || 500),
        'Paid Amount (₹)': Number(c.amount || 0),
        'Status': c.status || 'Pending',
        'Payment Date': pDate || '-',
        'Payment Mode': c.status === 'Paid' ? (c.payment_mode || 'Cash') : '-',
        'Receipt Number': c.receipt_number || '-',
        'Transaction ID': c.transaction_id || '-',
        'Notes': c.notes || ''
      };
    });

    const worksheetData = excelRows.length > 0 ? excelRows : [{
      'Sr No': '',
      'Member Name': '',
      'Mobile Number': '',
      'Village': '',
      'Month': month,
      'Expected Amount (₹)': mandal.monthly_amount || 500,
      'Paid Amount (₹)': 0,
      'Status': 'No records found',
      'Payment Date': '-',
      'Payment Mode': '-',
      'Receipt Number': '-',
      'Transaction ID': '-',
      'Notes': ''
    }];

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    worksheet['!cols'] = [
      { wch: 8 },  // Sr No
      { wch: 30 }, // Member Name
      { wch: 18 }, // Mobile Number
      { wch: 18 }, // Village
      { wch: 12 }, // Month
      { wch: 20 }, // Expected Amount
      { wch: 18 }, // Paid Amount
      { wch: 14 }, // Status
      { wch: 15 }, // Payment Date
      { wch: 16 }, // Payment Mode
      { wch: 18 }, // Receipt Number
      { wch: 20 }, // Transaction ID
      { wch: 25 }  // Notes
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = (mandal.name || 'Contributions').slice(0, 31).replace(/[:\\/?*\[\]]/g, '');
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Contributions');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const safeMandalName = (mandal.name || 'Mandal').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Contributions_${safeMandalName}_${month}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error in exportMonthlyContributions:', error);
    return res.status(500).json({ status: 500, message: 'Failed to export monthly contributions', error: error.message });
  }
};

// 10. Record / Update Payment for a Member
exports.recordContribution = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const { id } = req.params;
    const { status, amount, payment_date, payment_mode, transaction_id, notes, receipt_number } = req.body;

    const contrib = await MandalContribution.findById(id);
    if (!contrib) {
      return apiResponse(res, 404, 'Contribution record not found');
    }

    if (status !== undefined) contrib.status = status;
    if (amount !== undefined) contrib.amount = Number(amount);
    if (payment_date !== undefined) contrib.payment_date = new Date(payment_date);
    if (payment_mode !== undefined) contrib.payment_mode = payment_mode;
    if (transaction_id !== undefined) contrib.transaction_id = transaction_id;
    if (notes !== undefined) contrib.notes = notes;

    if (status === 'Paid') {
      contrib.recorded_by = req.user ? req.user._id : null;
      contrib.recorded_by_name = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Admin';
      if (!contrib.payment_date) contrib.payment_date = new Date();
      if (!contrib.receipt_number) {
        contrib.receipt_number = receipt_number || `MNDL-${Date.now().toString().slice(-6)}`;
      }
    }

    await contrib.save();
    return apiResponse(res, 200, 'Contribution recorded successfully', contrib);
  } catch (error) {
    console.error('Error in recordContribution:', error);
    return apiResponse(res, 500, error.message || 'Failed to record contribution');
  }
};

// 11. Bulk Mark Selected or All Pending as Paid for a Month
exports.bulkMarkPaid = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const { month, mandal_id, contribution_ids, payment_mode = 'Cash', payment_date = new Date() } = req.body;
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const targetMonth = month || currentMonthStr;

    const mandal = await resolveMandal(mandal_id);
    const mandalMemberIds = mandal.members || [];

    if (mandalMemberIds.length === 0) {
      return apiResponse(res, 400, 'No members enrolled in this Mandal');
    }

    let filter = {
      mandal_id: mandal._id,
      status: 'Pending'
    };

    if (Array.isArray(contribution_ids) && contribution_ids.length > 0) {
      filter._id = { $in: contribution_ids };
    } else {
      filter.month = targetMonth;
    }

    const pendingContribs = await MandalContribution.find(filter);

    if (pendingContribs.length === 0) {
      return apiResponse(res, 200, 'No pending contributions found for the selection', {
        updated_count: 0
      });
    }

    const recordedByName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Admin';

    for (const contrib of pendingContribs) {
      contrib.status = 'Paid';
      contrib.amount = contrib.expected_amount || mandal.monthly_amount || 500;
      contrib.payment_date = new Date(payment_date);
      contrib.payment_mode = payment_mode;
      contrib.recorded_by = req.user ? req.user._id : null;
      contrib.recorded_by_name = recordedByName;
      contrib.receipt_number = `MNDL-${Date.now().toString().slice(-6)}-${contrib._id.toString().slice(-4).toUpperCase()}`;
      await contrib.save();
    }

    return apiResponse(res, 200, `Successfully marked ${pendingContribs.length} members as Paid`, {
      updated_count: pendingContribs.length
    });
  } catch (error) {
    console.error('Error in bulkMarkPaid:', error);
    return apiResponse(res, 500, error.message || 'Failed to bulk mark as paid');
  }
};

// 12. Payment History (kept for API compatibility if called)
exports.getPaymentHistory = async (req, res) => {
  try {
    const isFullAdmin = isMandalAdminUser(req.user);
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const mandal = await resolveMandal(req.query.mandal_id);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const search = (req.query.search || '').trim();
    const paymentMode = req.query.payment_mode || 'All';
    const month = req.query.month || '';

    let query = {
      mandal_id: mandal._id,
      status: 'Paid'
    };

    if (!isFullAdmin && userId) {
      query.member_id = userId;
    }

    if (month) query.month = month;
    if (paymentMode && paymentMode !== 'All') query.payment_mode = paymentMode;

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { member_name: searchRegex },
        { member_number: searchRegex },
        { receipt_number: searchRegex },
        { transaction_id: searchRegex }
      ];
    }

    const total = await MandalContribution.countDocuments(query);
    const payments = await MandalContribution.find(query)
      .populate('member_id', 'first_name middle_name last_name number image profile_image')
      .sort({ payment_date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const allPaid = await MandalContribution.find(query).lean();
    const totalAmount = allPaid.reduce((sum, p) => sum + (p.amount || 0), 0);

    const formatted = payments.map(p => ({
      ...p,
      id: p._id,
      member_name: p.member_name || (p.member_id ? `${p.member_id.first_name || ''} ${p.member_id.last_name || ''}`.trim() : 'Unknown Member')
    }));

    return apiResponse(res, 200, 'Payment history fetched successfully', {
      data: formatted,
      total_amount: totalAmount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Error in getPaymentHistory:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch payment history');
  }
};

// 13. Mandal Dashboard
exports.getMandalDashboard = async (req, res) => {
  try {
    const isFullAdmin = isMandalAdminUser(req.user);
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const mandal = await resolveMandal(req.query.mandal_id);
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    const mandalMemberIds = mandal.members || [];
    const isEnrolled = mandalMemberIds.some(id => id.toString() === userId?.toString());

    if (!isFullAdmin && userId) {
      if (!isEnrolled) {
        return apiResponse(res, 200, 'User not enrolled in this mandal', {
          mandal: {
            id: mandal._id,
            name: mandal.name,
            monthly_amount: mandal.monthly_amount,
            due_day: mandal.due_day || 10,
            mandal_head_name: mandal.mandal_head_name,
            members_count: 0
          },
          metrics: {
            current_month: currentMonthStr,
            total_members: 0,
            month_expected: 0,
            month_collected: 0,
            month_pending: 0,
            total_collection: 0
          },
          recent_payments: []
        });
      }

      // Member specific metrics
      const myContrib = await MandalContribution.findOne({
        mandal_id: mandal._id,
        month: currentMonthStr,
        member_id: userId
      }).lean();

      const isPaid = myContrib?.status === 'Paid';
      const expAmt = Number(myContrib?.expected_amount || mandal.monthly_amount || 500);
      const paidAmt = isPaid ? Number(myContrib?.amount || expAmt) : 0;
      const pendAmt = isPaid ? 0 : expAmt;

      const myAllPaid = await MandalContribution.find({
        mandal_id: mandal._id,
        member_id: userId,
        status: 'Paid'
      }).lean();
      const myTotalCollection = myAllPaid.reduce((acc, c) => acc + (c.amount || 0), 0);

      const recentPayments = await MandalContribution.find({
        mandal_id: mandal._id,
        member_id: userId,
        status: 'Paid'
      })
        .sort({ payment_date: -1, updatedAt: -1 })
        .limit(5)
        .lean();

      return apiResponse(res, 200, 'Mandal dashboard fetched successfully', {
        mandal: {
          id: mandal._id,
          name: mandal.name,
          monthly_amount: mandal.monthly_amount,
          due_day: mandal.due_day || 10,
          mandal_head_name: mandal.mandal_head_name,
          members_count: 1
        },
        metrics: {
          current_month: currentMonthStr,
          total_members: 1,
          month_expected: expAmt,
          month_collected: paidAmt,
          month_pending: pendAmt,
          total_collection: myTotalCollection
        },
        recent_payments: recentPayments.map(p => ({
          ...p,
          id: p._id
        }))
      });
    }

    const totalMembers = mandalMemberIds.length;

    // Month metrics
    const monthContribs = await MandalContribution.find({
      mandal_id: mandal._id,
      month: currentMonthStr,
      member_id: { $in: mandalMemberIds }
    }).lean();

    const monthPaidList = monthContribs.filter(c => c.status === 'Paid');
    const monthCollected = monthPaidList.reduce((acc, c) => acc + (c.amount || 0), 0);
    const monthExpected = totalMembers * (mandal.monthly_amount || 500);
    const monthPending = Math.max(0, monthExpected - monthCollected);

    // All-time collections
    const allPaid = await MandalContribution.find({
      mandal_id: mandal._id,
      status: 'Paid'
    }).lean();
    const totalCollection = allPaid.reduce((acc, c) => acc + (c.amount || 0), 0);

    // Recent payments (top 5)
    const recentPayments = await MandalContribution.find({
      mandal_id: mandal._id,
      status: 'Paid'
    })
      .sort({ payment_date: -1, updatedAt: -1 })
      .limit(5)
      .lean();

    return apiResponse(res, 200, 'Mandal dashboard fetched successfully', {
      mandal: {
        id: mandal._id,
        name: mandal.name,
        monthly_amount: mandal.monthly_amount,
        due_day: mandal.due_day || 10,
        mandal_head_name: mandal.mandal_head_name,
        members_count: totalMembers
      },
      metrics: {
        current_month: currentMonthStr,
        total_members: totalMembers,
        month_expected: monthExpected,
        month_collected: monthCollected,
        month_pending: monthPending,
        total_collection: totalCollection
      },
      recent_payments: recentPayments.map(p => ({
        ...p,
        id: p._id
      }))
    });
  } catch (error) {
    console.error('Error in getMandalDashboard:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch mandal dashboard');
  }
};

// 14. Send Pending Contribution Reminders Notification
// Sends notification to members who have pending contributions for previous / current month
exports.sendPendingReminders = async (req, res) => {
  try {
    if (!isMandalAdminUser(req.user)) {
      return apiResponse(res, 403, 'Permission denied');
    }
    const { month, mandal_id } = req.body || {};
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let mandalQuery = { status: 1 };
    if (mandal_id && mongoose.isValidObjectId(mandal_id)) {
      mandalQuery = { _id: mandal_id };
    }
    const mandals = await Mandal.find(mandalQuery).lean();

    let totalNotificationsSent = 0;
    const notifiedMembers = [];

    for (const mandal of mandals) {
      const memberIds = mandal.members || [];
      if (!memberIds.length) continue;

      // Find pending contributions for this mandal & month
      const pendingContribs = await MandalContribution.find({
        mandal_id: mandal._id,
        month: targetMonth,
        member_id: { $in: memberIds },
        status: { $ne: 'Paid' }
      }).populate('member_id', 'first_name last_name number fcm_token').lean();

      // Also identify members in mandal who do not even have a contribution record created yet
      const existingMemberIds = new Set(pendingContribs.map(c => String(c.member_id?._id || c.member_id)));
      const paidContribs = await MandalContribution.find({
        mandal_id: mandal._id,
        month: targetMonth,
        member_id: { $in: memberIds },
        status: 'Paid'
      }).select('member_id').lean();
      paidContribs.forEach(c => existingMemberIds.add(String(c.member_id)));

      const unrecordedMemberIds = memberIds.filter(id => !existingMemberIds.has(String(id)));
      const unrecordedUsers = unrecordedMemberIds.length > 0 
        ? await User.find({ _id: { $in: unrecordedMemberIds } }, 'first_name last_name number fcm_token').lean()
        : [];

      // Combine both
      const allPendingMembers = [
        ...pendingContribs.map(c => ({
          userId: c.member_id?._id || c.member_id,
          name: c.member_name || `${c.member_id?.first_name || ''} ${c.member_id?.last_name || ''}`.trim() || 'Mandal Member',
          pendingAmount: c.expected_amount || mandal.monthly_amount || 500,
          mandalName: mandal.name
        })),
        ...unrecordedUsers.map(u => ({
          userId: u._id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Mandal Member',
          pendingAmount: mandal.monthly_amount || 500,
          mandalName: mandal.name
        }))
      ];

      for (const item of allPendingMembers) {
        if (!item.userId) continue;
        const title = `મંડળ યોગદાન રીમાઇન્ડર (${item.mandalName})`;
        const body = `આદરણીય ${item.name}, મહિનો ${targetMonth} નું મંડળ યોગદાન બાકી છે. બાકી રકમ: ₹${Number(item.pendingAmount).toLocaleString('en-IN')}. મહેરબાની કરીને જમા કરાવી આપશો.`;

        await createAndBroadcast({
          title,
          body,
          type: 'mandal',
          ref_id: String(mandal._id),
          target_type: 'specific',
          target_users: [String(item.userId)]
        });

        totalNotificationsSent++;
        notifiedMembers.push({
          member_id: item.userId,
          name: item.name,
          mandal: item.mandalName,
          amount: item.pendingAmount
        });
      }
    }

    return apiResponse(res, 200, `${totalNotificationsSent} સભ્યોને પેન્ડિંગ રકમનું નોટિફિકેશન સફળતાપૂર્વક મોકલવામાં આવ્યું છે.`, {
      total_sent: totalNotificationsSent,
      month: targetMonth,
      members: notifiedMembers
    });
  } catch (error) {
    console.error('Error in sendPendingReminders:', error);
    return apiResponse(res, 500, error.message || 'Failed to send pending notifications');
  }
};

// 15. Get Logged-in User's Mandal Contributions & Pending Dues
exports.getMyContributions = async (req, res) => {
  try {
    const isFullAdmin = isMandalAdminUser(req.user);
    const userId = req.user ? (req.user._id || req.user.id) : null;
    if (!userId) {
      return apiResponse(res, 401, 'Unauthorized: User not identified');
    }

    // Only admin can pass member_id to view another member's contributions
    let targetUserId = userId;
    if (isFullAdmin && req.query.member_id && mongoose.isValidObjectId(req.query.member_id)) {
      targetUserId = new mongoose.Types.ObjectId(req.query.member_id);
    }

    const userDoc = await User.findById(targetUserId)
      .select('first_name middle_name last_name number member_id village image profile_image')
      .lean();

    const userName = userDoc
      ? `${userDoc.first_name || ''} ${userDoc.middle_name || ''} ${userDoc.last_name || ''}`.trim()
      : (req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Member');
    const userNumber = userDoc?.number || req.user?.number || '';

    // Determine target mandal(s)
    let mandalQuery = { status: 1 };
    if (req.query.mandal_id && mongoose.isValidObjectId(req.query.mandal_id)) {
      mandalQuery._id = new mongoose.Types.ObjectId(req.query.mandal_id);
    }

    // Find mandals where user is listed in members
    let enrolledMandals = await Mandal.find({ ...mandalQuery, members: targetUserId }).lean();

    // If no mandals found in members, only admin can check fallback
    if (enrolledMandals.length === 0 && isFullAdmin) {
      if (req.query.mandal_id && mongoose.isValidObjectId(req.query.mandal_id)) {
        const singleMandal = await Mandal.findById(req.query.mandal_id).lean();
        if (singleMandal) {
          enrolledMandals = [singleMandal];
        }
      } else {
        const contribMandalIds = await MandalContribution.distinct('mandal_id', { member_id: targetUserId });
        if (contribMandalIds && contribMandalIds.length > 0) {
          enrolledMandals = await Mandal.find({ _id: { $in: contribMandalIds } }).lean();
        }
      }
    }

    if (!enrolledMandals || enrolledMandals.length === 0) {
      return apiResponse(res, 200, 'User is not enrolled in any Mandal', {
        user: {
          id: targetUserId,
          name: userName,
          number: userNumber,
          village: userDoc?.village || ''
        },
        is_enrolled: false,
        summary: {
          total_paid_amount: 0,
          total_pending_amount: 0,
          total_expected_amount: 0,
          total_paid_months: 0,
          total_pending_months: 0,
          total_months: 0,
          enrolled_mandals_count: 0
        },
        mandals: [],
        contributions: []
      });
    }

    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7); // e.g. '2026-10'

    const mandalsData = [];
    const allContributions = [];

    let overallTotalPaid = 0;
    let overallTotalPending = 0;
    let overallTotalExpected = 0;
    let overallTotalPaidMonths = 0;
    let overallTotalPendingMonths = 0;

    for (const mandal of enrolledMandals) {
      // Calculate months range from mandal.start_date to current month
      const start = mandal.start_date ? new Date(mandal.start_date) : now;
      const validStart = (isNaN(start.getTime()) || start > now) ? now : start;

      const months = [];
      const iter = new Date(validStart.getFullYear(), validStart.getMonth(), 1);
      const stop = new Date(now.getFullYear(), now.getMonth(), 1);

      let counter = 0;
      while (iter <= stop && counter < 60) {
        months.push(iter.toISOString().slice(0, 7));
        iter.setMonth(iter.getMonth() + 1);
        counter++;
      }

      if (months.length === 0 || !months.includes(currentMonthStr)) {
        if (!months.includes(currentMonthStr)) {
          months.push(currentMonthStr);
        }
      }

      // Check existing contributions for these months
      const existingContribs = await MandalContribution.find({
        mandal_id: mandal._id,
        member_id: targetUserId,
        month: { $in: months }
      }).select('month').lean();

      const existingMonthSet = new Set(existingContribs.map(c => c.month));
      const missingMonths = months.filter(m => !existingMonthSet.has(m));

      // Auto-insert pending records for missing active months
      if (missingMonths.length > 0) {
        const newRecords = missingMonths.map(mStr => ({
          mandal_id: mandal._id,
          member_id: targetUserId,
          member_name: userName,
          member_number: userNumber,
          month: mStr,
          amount: 0,
          expected_amount: mandal.monthly_amount || 500,
          status: 'Pending',
          payment_mode: 'Cash'
        }));

        await MandalContribution.insertMany(newRecords, { ordered: false }).catch(() => {});
      }

      // Build query to fetch contributions for this mandal & user
      let contribFilter = {
        mandal_id: mandal._id,
        member_id: targetUserId
      };

      if (req.query.month) {
        contribFilter.month = req.query.month;
      }
      if (req.query.year) {
        contribFilter.month = new RegExp(`^${req.query.year}-`);
      }
      if (req.query.status && req.query.status !== 'All') {
        contribFilter.status = req.query.status;
      }

      const mandalContribs = await MandalContribution.find(contribFilter)
        .sort({ month: -1 })
        .lean();

      let mandalPaidAmount = 0;
      let mandalPendingAmount = 0;
      let mandalExpectedAmount = 0;
      let mandalPaidMonths = 0;
      let mandalPendingMonths = 0;

      const formattedContribs = mandalContribs.map(c => {
        const expAmt = Number(c.expected_amount || mandal.monthly_amount || 500);
        const actAmt = Number(c.amount || 0);
        const isPaid = c.status === 'Paid';
        const pendingAmt = isPaid ? 0 : Math.max(0, expAmt - actAmt);

        mandalExpectedAmount += expAmt;
        mandalPaidAmount += actAmt;
        mandalPendingAmount += pendingAmt;

        if (isPaid) {
          mandalPaidMonths++;
        } else {
          mandalPendingMonths++;
        }

        const recId = String(c._id || c.id);
        const downloadUrl = buildContributionDownloadUrl(recId, req);

        const item = {
          id: c._id,
          _id: c._id,
          mandal_id: mandal._id,
          mandal_name: mandal.name,
          month: c.month,
          expected_amount: expAmt,
          amount: actAmt,
          paid_amount: actAmt,
          pending_amount: pendingAmt,
          status: c.status || 'Pending',
          payment_date: c.payment_date || null,
          payment_mode: c.payment_mode || 'Cash',
          receipt_number: c.receipt_number || '',
          transaction_id: c.transaction_id || '',
          notes: c.notes || '',
          recorded_by_name: c.recorded_by_name || '',
          download_url: downloadUrl,
          receipt_url: downloadUrl,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        };

        allContributions.push(item);
        return item;
      });

      // Current month status for this mandal
      const currentMonthRecord = formattedContribs.find(c => c.month === currentMonthStr);
      const currentMonthStatus = currentMonthRecord ? currentMonthRecord.status : 'Pending';

      overallTotalPaid += mandalPaidAmount;
      overallTotalPending += mandalPendingAmount;
      overallTotalExpected += mandalExpectedAmount;
      overallTotalPaidMonths += mandalPaidMonths;
      overallTotalPendingMonths += mandalPendingMonths;

      mandalsData.push({
        mandal_id: mandal._id,
        mandal_name: mandal.name,
        monthly_amount: mandal.monthly_amount || 500,
        due_day: mandal.due_day || 10,
        start_date: mandal.start_date || null,
        mandal_head_name: mandal.mandal_head_name || '',
        summary: {
          total_paid_amount: mandalPaidAmount,
          total_pending_amount: mandalPendingAmount,
          total_expected_amount: mandalExpectedAmount,
          paid_months_count: mandalPaidMonths,
          pending_months_count: mandalPendingMonths,
          total_months: formattedContribs.length,
          current_month: currentMonthStr,
          current_month_status: currentMonthStatus
        },
        contributions: formattedContribs
      });
    }

    // Sort all contributions across mandals by month desc
    allContributions.sort((a, b) => (b.month || '').localeCompare(a.month || ''));

    // Optional pagination
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    let paginatedContributions = allContributions;
    let paginationInfo = undefined;

    if (page && limit) {
      const total = allContributions.length;
      paginatedContributions = allContributions.slice((page - 1) * limit, page * limit);
      paginationInfo = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      };
    }

    return apiResponse(res, 200, 'User contributions retrieved successfully', {
      user: {
        id: targetUserId,
        name: userName,
        number: userNumber,
        village: userDoc?.village || ''
      },
      is_enrolled: true,
      summary: {
        total_paid_amount: overallTotalPaid,
        total_pending_amount: overallTotalPending,
        total_expected_amount: overallTotalExpected,
        total_paid_months: overallTotalPaidMonths,
        total_pending_months: overallTotalPendingMonths,
        total_months: allContributions.length,
        enrolled_mandals_count: mandalsData.length
      },
      mandals: mandalsData,
      contributions: paginatedContributions
    }, paginationInfo);
  } catch (error) {
    console.error('Error in getMyContributions:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch user contributions');
  }
};

// 15. Download Mandal Monthly Contribution Receipt PDF
exports.downloadContributionReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const contrib = await MandalContribution.findOne({
      $or: orConditions
    }).populate('mandal_id').populate('member_id');

    if (!contrib) {
      return res.status(404).json({
        status: 404,
        message: 'Contribution record not found',
        data: null
      });
    }

    // Resolve tenant / community config if available
    let config = null;
    try {
      const Config = require('../models/configModel');
      config = await Config.findOne().lean();
    } catch (_) { }

    let renderReceiptFn = renderContributionReceiptHtml;
    try {
      delete require.cache[require.resolve('../templates/mandalContributionReceiptTemplateService')];
      renderReceiptFn = require('../templates/mandalContributionReceiptTemplateService').renderContributionReceiptHtml;
    } catch (_) { }

    const html = await renderReceiptFn(contrib, config || {});

    const cleanMember = (contrib.member_name || 'Member').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const recId = String(contrib.id || contrib._id).slice(-6).toUpperCase();
    const filename = `Mandal_Contribution_Receipt_${cleanMember}_${recId}`;

    const pdfBuffer = await generatePdfFromHtml(html, {
      filename,
      format: 'A5',
      landscape: true,
    });

    const isInline = req.query.view === 'true' || req.query.inline === 'true' || req.path.includes('/view');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${filename}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}.pdf`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Error generating contribution receipt PDF:', error);
    return res.status(500).json({
      status: 500,
      message: 'Failed to generate contribution receipt PDF',
      error: error.message
    });
  }
};

// 16. Get Receipt Download Link
exports.getContributionReceiptLink = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const contrib = await MandalContribution.findOne({
      $or: orConditions
    });

    if (!contrib) {
      return res.status(404).json({
        status: 404,
        message: 'Contribution record not found',
        data: null
      });
    }

    const recId = String(contrib.id || contrib._id);
    const downloadUrl = buildContributionDownloadUrl(recId, req);

    return res.status(200).json({
      status: 200,
      message: 'Receipt download link generated successfully',
      data: {
        id: recId,
        member_name: contrib.member_name || '',
        receipt_number: contrib.receipt_number || `MNDL-${recId.slice(-6).toUpperCase()}`,
        download_url: downloadUrl
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Failed to retrieve receipt link',
      error: error.message
    });
  }
};

// 17. Bulk Download Contribution Receipts as Combined PDF
exports.bulkDownloadContributionReceipts = async (req, res) => {
  try {
    const params = (req.method === 'POST' ? req.body : req.query) || {};
    const { ids, month, mandal_id, search, payment_mode } = params;

    let query = {};

    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.map(id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);
      query._id = { $in: validIds };
    } else if (typeof ids === 'string' && ids.trim()) {
      const splitIds = ids.split(',').map(s => s.trim()).filter(Boolean);
      const validIds = splitIds.map(id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);
      query._id = { $in: validIds };
    } else {
      if (month && month !== 'All') {
        query.month = month;
      }
      if (mandal_id && mongoose.isValidObjectId(mandal_id)) {
        query.mandal_id = mandal_id;
      }
      if (payment_mode && payment_mode !== 'All') {
        query.payment_mode = payment_mode;
      }
      if (search && search.trim()) {
        const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { member_name: regex },
          { member_number: regex },
          { receipt_number: regex },
          { transaction_id: regex }
        ];
      }
    }

    // Only download receipts for Paid records
    query.status = 'Paid';

    const records = await MandalContribution.find(query)
      .populate('mandal_id')
      .populate('member_id')
      .sort({ payment_date: -1, createdAt: -1 })
      .lean();

    if (!records || records.length === 0) {
      return res.status(404).json({
        status: 404,
        message: 'No paid contribution records found to generate receipts',
        data: null
      });
    }

    // Resolve tenant / community config if available
    let config = null;
    try {
      const Config = require('../models/configModel');
      config = await Config.findOne().lean();
    } catch (_) { }

    let renderReceiptFn = renderContributionReceiptHtml;
    try {
      delete require.cache[require.resolve('../templates/mandalContributionReceiptTemplateService')];
      renderReceiptFn = require('../templates/mandalContributionReceiptTemplateService').renderContributionReceiptHtml;
    } catch (_) { }

    // Render each receipt wrapped in page container with page breaks
    const renderedPages = [];
    for (const record of records) {
      const singleHtml = await renderReceiptFn(record, config || {});
      renderedPages.push(singleHtml);
    }

    const combinedHtml = renderedPages.join('\n');
    const safeMonth = (month || 'Selected').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `Mandal_Contribution_Receipts_${safeMonth}_Total_${records.length}`;

    const pdfBuffer = await generatePdfFromHtml(combinedHtml, {
      filename,
      format: 'A5',
      landscape: true,
    });

    const isInline = req.query?.view === 'true' || req.query?.inline === 'true';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${filename}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}.pdf`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Error in bulkDownloadContributionReceipts:', error);
    return res.status(500).json({
      status: 500,
      message: 'Failed to generate bulk contribution receipts PDF',
      error: error.message
    });
  }
};

// 18. Get Bulk Receipts Download Link
exports.getBulkContributionReceiptsLink = async (req, res) => {
  try {
    const params = (req.method === 'POST' ? req.body : req.query) || {};
    const { ids, month, mandal_id, search, payment_mode } = params;

    const baseUrl = resolveBaseUrl(req);
    const token = req?.query?.token || '';
    const tokenQuery = token ? `token=${encodeURIComponent(token)}` : '';

    const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host') || '';
    const referer = req?.headers?.['referer'] || '';
    const isApiApi = (req?.originalUrl && req.originalUrl.includes('/api/api')) ||
                      host.includes('parivar.me') ||
                      referer.includes('parivar.me');

    const prefix = isApiApi ? '/api/api' : '/api';

    const queryParams = [];
    if (tokenQuery) queryParams.push(tokenQuery);
    if (Array.isArray(ids) && ids.length > 0) {
      queryParams.push(`ids=${encodeURIComponent(ids.join(','))}`);
    } else if (typeof ids === 'string' && ids.trim()) {
      queryParams.push(`ids=${encodeURIComponent(ids)}`);
    }
    if (month) queryParams.push(`month=${encodeURIComponent(month)}`);
    if (mandal_id) queryParams.push(`mandal_id=${encodeURIComponent(mandal_id)}`);
    if (payment_mode) queryParams.push(`payment_mode=${encodeURIComponent(payment_mode)}`);
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const downloadUrl = `${baseUrl}${prefix}/mandal/contributions/receipts/bulk-download${queryString}`;

    return res.status(200).json({
      status: 200,
      message: 'Bulk receipts download link generated successfully',
      data: {
        download_url: downloadUrl
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Failed to generate bulk receipts link',
      error: error.message
    });
  }
};

