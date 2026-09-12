const Mandal = require('../models/mandalModel');
const MandalContribution = require('../models/mandalContributionModel');
const MandalExpense = require('../models/mandalExpenseModel');
const User = require('../models/userModels');
const { apiResponse } = require('../utils/apiResponse');
const { uploadToExternalService } = require('../utils/fileUpload');
const mongoose = require('mongoose');

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

// 1. List All Mandals (Multiple Mandals)
exports.getMandalsList = async (req, res) => {
  try {
    const mandals = await Mandal.find()
      .populate('mandal_head_id', 'first_name middle_name last_name number profile_image image')
      .sort({ createdAt: -1 })
      .lean();

    if (mandals.length === 0) {
      const def = await resolveMandal();
      return apiResponse(res, 200, 'Mandals list retrieved successfully', [{
        ...def.toObject(),
        id: def._id,
        members_count: (def.members || []).length
      }]);
    }

    const formatted = mandals.map(m => ({
      ...m,
      id: m._id,
      members_count: (m.members || []).length
    }));

    return apiResponse(res, 200, 'Mandals list retrieved successfully', formatted);
  } catch (error) {
    console.error('Error in getMandalsList:', error);
    return apiResponse(res, 500, error.message || 'Failed to fetch mandals list');
  }
};

// 2. Create New Mandal
exports.createMandal = async (req, res) => {
  try {
    const { name, monthly_amount, start_date, mandal_head_id, status, description, rules } = req.body;

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
    const mandalId = req.query.mandal_id || req.params.id || req.body.mandal_id;
    const mandal = await resolveMandal(mandalId);
    const { name, monthly_amount, start_date, mandal_head_id, status, description, rules } = req.body;

    if (name !== undefined) mandal.name = name;
    if (monthly_amount !== undefined) mandal.monthly_amount = Number(monthly_amount);
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
    const mandal = await resolveMandal(req.query.mandal_id);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const search = (req.query.search || '').trim();
    const filterType = req.query.filter_type || 'all'; // 'all', 'mandal_only', 'non_mandal'

    const mandalMemberIds = (mandal.members || []).map(id => id.toString());

    let query = {};
    if (filterType === 'mandal_only') {
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
      total_mandal_members: mandalMemberIds.length,
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
    const mandal = await resolveMandal(req.query.mandal_id);
    const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const month = req.query.month || currentMonthStr;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const statusFilter = req.query.status || 'All'; // 'All', 'Paid', 'Pending'
    const search = (req.query.search || '').trim();

    const mandalMemberIds = mandal.members || [];

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

    if (statusFilter && statusFilter !== 'All') {
      query.status = statusFilter;
    }

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
    const contributions = await MandalContribution.find(query)
      .populate('member_id', 'first_name middle_name last_name number image profile_image village')
      .sort({ status: 1, member_name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Summary calculation for the given month
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

    const formatted = contributions.map(c => ({
      ...c,
      id: c._id,
      member_name: c.member_name || (c.member_id ? `${c.member_id.first_name || ''} ${c.member_id.last_name || ''}`.trim() : 'Unknown Member'),
      member_number: c.member_number || c.member_id?.number || ''
    }));

    return apiResponse(res, 200, 'Monthly contributions fetched successfully', {
      data: formatted,
      summary: {
        month,
        total_members: totalMembers,
        paid_members: paidMembersCount,
        pending_members: pendingMembersCount,
        expected_amount: expectedAmount,
        collected_amount: collectedAmount,
        pending_amount: pendingAmount
      },
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

// 10. Record / Update Payment for a Member
exports.recordContribution = async (req, res) => {
  try {
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

// 11. Bulk Mark All as Paid for a Month
exports.bulkMarkPaid = async (req, res) => {
  try {
    const { month, mandal_id, payment_mode = 'Cash', payment_date = new Date() } = req.body;
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const targetMonth = month || currentMonthStr;

    const mandal = await resolveMandal(mandal_id);
    const mandalMemberIds = mandal.members || [];

    if (mandalMemberIds.length === 0) {
      return apiResponse(res, 400, 'No members enrolled in this Mandal');
    }

    const pendingContribs = await MandalContribution.find({
      mandal_id: mandal._id,
      month: targetMonth,
      status: 'Pending'
    });

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

    return apiResponse(res, 200, `Successfully marked ${pendingContribs.length} members as Paid for ${targetMonth}`, {
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

    const allPaid = await MandalContribution.find({ mandal_id: mandal._id, status: 'Paid' }).lean();
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
    const mandal = await resolveMandal(req.query.mandal_id);
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    const mandalMemberIds = mandal.members || [];
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
