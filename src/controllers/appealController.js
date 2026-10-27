const mongoose = require('mongoose');
const Appeal = require('../models/appealModel');
const User = require('../models/userModels');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const { createAndBroadcast } = require('./notificationController');

const isObjectId = (id) => mongoose.isValidObjectId(id);

const findAppeal = async (id) => {
  if (!id) return null;
  return Appeal.findOne({
    $or: [
      { id: String(id) },
      ...(isObjectId(id) ? [{ _id: id }] : [])
    ]
  });
};

const checkIsAdmin = (req) => {
  const user = req.user;
  if (!user) return false;
  const roleName = user.role_id?.name?.toLowerCase() || user.role_id?.roleName?.toLowerCase() || String(user.role || '').toLowerCase();
  return (
    user.role === 'admin' ||
    user.role === 'superadmin' ||
    roleName === 'admin' ||
    roleName === 'super admin' ||
    user.committee_role === 'President' ||
    user.committee_role === 'Admin' ||
    user.is_super_admin === true ||
    (user.is_committee && (!user.role_id || user.committee_role === 'Admin'))
  );
};

const checkIsOwn = (appeal, user) => {
  if (!user || !appeal) return false;
  const userIds = new Set([
    String(user._id || ''),
    String(user.id || ''),
    String(user.member_id || ''),
    String(user.number || '')
  ].filter(Boolean));

  const appealIds = [
    String(appeal.created_by?.id || ''),
    String(appeal.created_by?.member_id || ''),
    String(appeal.created_by?.phone || ''),
    String(appeal.member_id || ''),
    String(appeal.contact_phone || '')
  ].filter(Boolean);

  return appealIds.some(id => userIds.has(id));
};

const checkIsAssigned = (appeal, user) => {
  if (!user || !appeal) return false;
  const userIds = new Set([
    String(user._id || ''),
    String(user.id || ''),
    String(user.member_id || '')
  ].filter(Boolean));

  if (appeal.assigned_to?.id && userIds.has(String(appeal.assigned_to.id))) {
    return true;
  }
  if (Array.isArray(appeal.assigned_members)) {
    return appeal.assigned_members.some(m => userIds.has(String(m.id || m._id || '')));
  }
  return false;
};

const formatAppeal = (req, item = {}) => {
  const rawImages = Array.isArray(item.images) ? item.images : (item.images ? [item.images] : []);
  const images = rawImages.map(img => publicUrl(req, img)).filter(Boolean);

  const rawDocs = Array.isArray(item.documents) ? item.documents : [];
  const documents = rawDocs.map(doc => {
    if (typeof doc === 'string') {
      return { name: doc.split('/').pop() || 'Document', url: publicUrl(req, doc) };
    }
    return {
      name: doc.name || (doc.url ? doc.url.split('/').pop() : 'Document'),
      url: publicUrl(req, doc.url || ''),
      type: doc.type || ''
    };
  }).filter(d => Boolean(d.url));

  return {
    _id: String(item._id),
    id: item.id || String(item._id),
    title: item.title || '',
    help_type: item.help_type || 'Medical',
    description: item.description || '',
    required_help: item.required_help || '',
    required_amount: Number(item.required_amount || 0),
    collected_amount: Number(item.collected_amount || 0),
    images,
    documents,
    contact_name: item.contact_name || '',
    contact_phone: item.contact_phone || '',
    contact_alt_phone: item.contact_alt_phone || '',
    contact_city: item.contact_city || '',
    contact_address: item.contact_address || '',
    patient_name: item.patient_name || '',
    hospital_name: item.hospital_name || '',
    bank_name: item.bank_name || '',
    account_holder_name: item.account_holder_name || '',
    account_number: item.account_number || '',
    ifsc_code: item.ifsc_code || '',
    upi_id: item.upi_id || '',
    qr_code_image: item.qr_code_image ? publicUrl(req, item.qr_code_image) : '',
    status: item.status || 'Pending',
    admin_notes: item.admin_notes || '',
    rejection_reason: item.rejection_reason || '',
    approved_at: item.approved_at || null,
    approved_by: item.approved_by || null,
    completed_at: item.completed_at || null,
    created_by: item.created_by || null,
    member_id: item.member_id || '',
    assigned_to: (item.assigned_to && (item.assigned_to.id || item.assigned_to.name)) ? item.assigned_to : null,
    assigned_members: Array.isArray(item.assigned_members) ? item.assigned_members : [],
    admin: (item.approved_by && item.approved_by.name)
      ? item.approved_by
      : (item.assigned_to?.assigned_by && item.assigned_to.assigned_by.name)
        ? item.assigned_to.assigned_by
        : null,
    notifications_sent: Array.isArray(item.notifications_sent) ? item.notifications_sent : [],
    notification_count: Array.isArray(item.notifications_sent) ? item.notifications_sent.length : 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
};

/**
 * GET /api/appeals
 * Fetch appeals list with role-based filtering, status tabs, search & pagination
 */
const getAppeals = async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = checkIsAdmin(req);
    const { is_own, status, help_type, search } = req.query;

    let baseQuery = {};

    if (is_own === 'true' && user) {
      // Member requested their own submissions (all statuses visible)
      const userIds = [
        String(user._id || ''),
        String(user.id || ''),
        String(user.member_id || '')
      ].filter(Boolean);
      const objectIds = userIds.filter(id => isObjectId(id)).map(id => new mongoose.Types.ObjectId(id));

      baseQuery.$or = [
        { member_id: { $in: userIds } },
        { contact_phone: String(user.number || '') }
      ];
      if (objectIds.length > 0) {
        baseQuery.$or.push({ 'created_by.id': { $in: objectIds } });
      }
    } else if (!isAdmin) {
      // Public / Community member listing: only Approved and Completed appeals are shown
      if (status && ['Approved', 'Completed'].includes(status)) {
        baseQuery.status = status;
      } else {
        baseQuery.status = { $in: ['Approved', 'Completed'] };
      }
    }

    const { data, pagination } = await queryHelper(Appeal, req.query, {
      baseQuery,
      searchFields: [
        'title',
        'description',
        'required_help',
        'contact_name',
        'contact_phone',
        'contact_city',
        'patient_name',
        'hospital_name'
      ],
      filterFields: ['status', 'help_type', 'contact_city']
    });

    return apiResponse(
      res,
      200,
      'Appeals retrieved successfully',
      data.map(item => formatAppeal(req, item)),
      pagination
    );
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error retrieving appeals');
  }
};

/**
 * GET /api/appeals/my
 * Convenience endpoint for logged-in user to see all their submitted help requests ("mene jo appeals kiya")
 * If ?type=assigned or ?tab=assigned is passed, delegates to getAssignedAppeals
 */
const getMyAppeals = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return apiResponse(res, 401, 'Unauthorized');

    const userIds = [
      String(user._id || ''),
      String(user.id || ''),
      String(user.member_id || '')
    ].filter(Boolean);
    const objectIds = userIds.filter(id => isObjectId(id)).map(id => new mongoose.Types.ObjectId(id));

    const baseQuery = {
      $or: [
        { member_id: { $in: userIds } },
        { contact_phone: String(user.number || '') }
      ]
    };
    if (objectIds.length > 0) {
      baseQuery.$or.push({ 'created_by.id': { $in: objectIds } });
    }

    if (req.query.page || req.query.limit || req.query.search || req.query.status || req.query.help_type) {
      const { data, pagination } = await queryHelper(Appeal, req.query, {
        baseQuery,
        searchFields: [
          'title',
          'description',
          'required_help',
          'contact_name',
          'patient_name',
          'hospital_name'
        ],
        filterFields: ['status', 'help_type']
      });
      return apiResponse(
        res,
        200,
        'My submitted appeals retrieved successfully',
        data.map(item => formatAppeal(req, item)),
        pagination
      );
    }

    const appeals = await Appeal.find(baseQuery).sort({ createdAt: -1 }).lean();
    return apiResponse(res, 200, 'My submitted appeals retrieved successfully', appeals.map(a => formatAppeal(req, a)));
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error retrieving my appeals');
  }
};

/**
 * GET /api/appeals/stats
 * Get overview counts for admin dashboard
 */
const getStats = async (req, res) => {
  try {
    const [total, pending, approved, rejected, completed] = await Promise.all([
      Appeal.countDocuments({}),
      Appeal.countDocuments({ status: 'Pending' }),
      Appeal.countDocuments({ status: 'Approved' }),
      Appeal.countDocuments({ status: 'Rejected' }),
      Appeal.countDocuments({ status: 'Completed' })
    ]);

    return apiResponse(res, 200, 'Appeal statistics fetched', {
      total,
      pending,
      approved,
      rejected,
      completed
    });
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error fetching stats');
  }
};

/**
 * GET /api/appeals/:id
 * Retrieve single appeal with privacy check
 */
const getAppealById = async (req, res) => {
  try {
    const appeal = await findAppeal(req.params.id);
    if (!appeal) {
      return apiResponse(res, 404, 'Appeal not found');
    }

    const isAdmin = checkIsAdmin(req);
    const isOwner = checkIsOwn(appeal, req.user);
    const isAssigned = checkIsAssigned(appeal, req.user);

    // If appeal is Pending or Rejected, only Admin, Submitter, or Assigned Member can view full details
    if (!isAdmin && !isOwner && !isAssigned && !['Approved', 'Completed'].includes(appeal.status)) {
      return apiResponse(res, 403, 'This help request is awaiting admin review and is not publicly visible.');
    }

    return apiResponse(res, 200, 'Appeal retrieved successfully', formatAppeal(req, appeal.toObject ? appeal.toObject() : appeal));
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error retrieving appeal');
  }
};

/**
 * POST /api/appeals
 * Member / Admin submits a new Help Request
 */
const createAppeal = async (req, res) => {
  try {
    const user = req.user || {};
    const {
      title,
      help_type = 'Medical',
      description = '',
      required_help,
      required_amount = 0,
      contact_name,
      contact_phone,
      contact_alt_phone = '',
      contact_city = '',
      contact_address = '',
      patient_name = '',
      hospital_name = '',
      bank_name = '',
      account_holder_name = '',
      account_number = '',
      ifsc_code = '',
      upi_id = '',
      qr_code_image = ''
    } = req.body;

    if (!title || !required_help || !contact_name || !contact_phone) {
      return apiResponse(res, 400, 'Title, required help details, contact name and phone are required.');
    }

    // Process images
    let images = [];
    if (Array.isArray(req.body.images)) {
      images = req.body.images.filter(Boolean);
    } else if (typeof req.body.images === 'string' && req.body.images.trim()) {
      images = [req.body.images.trim()];
    } else if (req.body.image) {
      images = [req.body.image];
    }

    // Process documents
    let documents = [];
    if (Array.isArray(req.body.documents)) {
      documents = req.body.documents.map(d => {
        if (typeof d === 'string') return { name: d.split('/').pop() || 'Document', url: d };
        return d;
      }).filter(d => Boolean(d?.url));
    } else if (typeof req.body.documents === 'string' && req.body.documents.trim()) {
      try {
        const parsed = JSON.parse(req.body.documents);
        if (Array.isArray(parsed)) documents = parsed;
      } catch (_) {
        documents = [{ name: 'Document', url: req.body.documents.trim() }];
      }
    } else if (req.body.document) {
      documents = [{ name: 'Document', url: req.body.document }];
    }

    const newAppeal = new Appeal({
      id: new mongoose.Types.ObjectId().toString(),
      title: String(title).trim(),
      help_type: ['Medical', 'Financial', 'Emergency', 'Other'].includes(help_type) ? help_type : 'Medical',
      description: description ? String(description).trim() : '',
      required_help: String(required_help).trim(),
      required_amount: Number(required_amount) || 0,
      collected_amount: 0,
      images,
      documents,
      contact_name: String(contact_name).trim(),
      contact_phone: String(contact_phone).trim(),
      contact_alt_phone: String(contact_alt_phone || '').trim(),
      contact_city: String(contact_city || '').trim(),
      contact_address: String(contact_address || '').trim(),
      patient_name: String(patient_name || '').trim(),
      hospital_name: String(hospital_name || '').trim(),
      bank_name: String(bank_name || '').trim(),
      account_holder_name: String(account_holder_name || '').trim(),
      account_number: String(account_number || '').trim(),
      ifsc_code: String(ifsc_code || '').trim(),
      upi_id: String(upi_id || '').trim(),
      qr_code_image: String(qr_code_image || req.body.qr_code || '').trim(),
      status: 'Pending',
      created_by: {
        id: isObjectId(user._id || user.id) ? (user._id || user.id) : undefined,
        name: fullName(user) || user.name || contact_name,
        phone: user.number || contact_phone,
        member_id: user.member_id || ''
      },
      member_id: user.member_id || '',
      cdate: new Date().toISOString().slice(0, 10)
    });

    await newAppeal.save();

    return apiResponse(res, 200, 'Help request submitted successfully. It will be reviewed by admin shortly.', formatAppeal(req, newAppeal.toObject()));
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error submitting appeal');
  }
};

/**
 * PUT /api/appeals/:id
 * Edit appeal details
 */
const updateAppeal = async (req, res) => {
  try {
    const appeal = await findAppeal(req.params.id);
    if (!appeal) return apiResponse(res, 404, 'Appeal not found');

    const isAdmin = checkIsAdmin(req);
    const isOwner = checkIsOwn(appeal, req.user);

    if (!isAdmin && (!isOwner || appeal.status !== 'Pending')) {
      return apiResponse(res, 403, 'You can only edit your own appeal while it is pending review.');
    }

    const allowedFields = [
      'title', 'help_type', 'description', 'required_help', 'required_amount',
      'contact_name', 'contact_phone', 'contact_alt_phone', 'contact_city', 'contact_address',
      'patient_name', 'hospital_name', 'bank_name', 'account_holder_name',
      'account_number', 'ifsc_code', 'upi_id', 'qr_code_image'
    ];

    if (isAdmin) {
      allowedFields.push('collected_amount', 'admin_notes', 'rejection_reason', 'assigned_to', 'assigned_members');
    }

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        appeal[field] = req.body[field];
      }
    });

    if (Array.isArray(req.body.images)) {
      appeal.images = req.body.images.filter(Boolean);
    }
    if (Array.isArray(req.body.documents)) {
      appeal.documents = req.body.documents;
    }

    await appeal.save();
    return apiResponse(res, 200, 'Appeal updated successfully', formatAppeal(req, appeal.toObject()));
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error updating appeal');
  }
};

/**
 * PATCH /api/appeals/:id/status
 * Admin updates status (Approve, Reject, Complete) + remarks
 */
const updateStatus = async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return apiResponse(res, 403, 'Forbidden: Admin access required');
    }

    const { status, admin_notes, rejection_reason } = req.body;
    if (!['Pending', 'Approved', 'Rejected', 'Completed'].includes(status)) {
      return apiResponse(res, 400, 'Invalid status. Must be Pending, Approved, Rejected, or Completed.');
    }

    const appeal = await findAppeal(req.params.id);
    if (!appeal) return apiResponse(res, 404, 'Appeal not found');

    appeal.status = status;
    if (admin_notes !== undefined) appeal.admin_notes = admin_notes;
    if (rejection_reason !== undefined) appeal.rejection_reason = rejection_reason;

    if (status === 'Approved') {
      appeal.approved_at = new Date();
      appeal.approved_by = {
        id: req.user?._id || req.user?.id,
        name: fullName(req.user) || req.user?.name || 'Admin'
      };
    } else if (status === 'Completed') {
      appeal.completed_at = new Date();
    }

    await appeal.save();
    return apiResponse(res, 200, `Appeal status updated to ${status}`, formatAppeal(req, appeal.toObject()));
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error updating status');
  }
};

/**
 * POST /api/appeals/:id/notify
 * Admin broadcasts push notification to all or selected members
 */
const sendNotification = async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return apiResponse(res, 403, 'Forbidden: Admin access required');
    }

    const appeal = await findAppeal(req.params.id);
    if (!appeal) return apiResponse(res, 404, 'Appeal not found');

    const {
      target_type = 'all', // 'all' or 'specific'
      target_user_ids = [],
      title = `Urgent Appeal: ${appeal.title}`,
      message = appeal.description?.slice(0, 160) || '',
      instructions = ''
    } = req.body;

    if (!title || !message) {
      return apiResponse(res, 400, 'Notification title and message are required.');
    }

    let cleanTargetIds = [];
    if (target_type === 'specific') {
      cleanTargetIds = Array.isArray(target_user_ids) ? target_user_ids.filter(Boolean) : [];
      if (!cleanTargetIds.length) {
        return apiResponse(res, 400, 'Please select at least one recipient member for specific broadcast.');
      }
    }

    // Determine recipient count
    let recipientCount = 0;
    if (target_type === 'all') {
      recipientCount = await User.countDocuments({ fcm_token: { $exists: true, $ne: '' } });
    } else {
      recipientCount = cleanTargetIds.length;
    }

    const imageUrl = appeal.images?.[0] ? publicUrl(req, appeal.images[0]) : '';
    const fullBody = instructions ? `${message}\n\nNote: ${instructions}` : message;

    // Trigger In-App Notification & Firebase Cloud Messaging
    await createAndBroadcast({
      title,
      body: fullBody,
      image: imageUrl,
      type: 'appeal',
      ref_id: String(appeal._id),
      target_type: target_type === 'specific' ? 'specific' : 'all',
      target_users: cleanTargetIds,
      instructions
    });

    // Record notification in appeal history
    const notificationRecord = {
      title,
      message,
      instructions,
      target_type: target_type === 'specific' ? 'specific' : 'all',
      recipient_count: recipientCount,
      target_user_ids: cleanTargetIds,
      sent_at: new Date(),
      sent_by: {
        id: req.user?._id || req.user?.id,
        name: fullName(req.user) || req.user?.name || 'Admin'
      }
    };

    if (!Array.isArray(appeal.notifications_sent)) {
      appeal.notifications_sent = [];
    }
    appeal.notifications_sent.unshift(notificationRecord);
    await appeal.save();

    return apiResponse(res, 200, 'Push notification broadcasted successfully to community members.', {
      sent_record: notificationRecord,
      total_sent: appeal.notifications_sent.length
    });
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error broadcasting notification');
  }
};

/**
 * GET /api/appeals/:id/notifications
 * Admin views notification broadcast history for this appeal
 */
const getNotificationHistory = async (req, res) => {
  try {
    const appeal = await findAppeal(req.params.id);
    if (!appeal) return apiResponse(res, 404, 'Appeal not found');

    return apiResponse(res, 200, 'Notification history retrieved', appeal.notifications_sent || []);
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error retrieving notification history');
  }
};

/**
 * DELETE /api/appeals/:id
 * Delete appeal
 */
const deleteAppeal = async (req, res) => {
  try {
    const appeal = await findAppeal(req.params.id);
    if (!appeal) return apiResponse(res, 404, 'Appeal not found');

    const isAdmin = checkIsAdmin(req);
    const isOwner = checkIsOwn(appeal, req.user);

    if (!isAdmin && (!isOwner || appeal.status !== 'Pending')) {
      return apiResponse(res, 403, 'You do not have permission to delete this appeal.');
    }

    await Appeal.deleteOne({ _id: appeal._id });
    return apiResponse(res, 200, 'Appeal deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, error.message || 'Error deleting appeal');
  }
};

module.exports = {
  getAppeals,
  getMyAppeals,
  getStats,
  getAppealById,
  createAppeal,
  updateAppeal,
  updateStatus,
  sendNotification,
  deleteAppeal
};
