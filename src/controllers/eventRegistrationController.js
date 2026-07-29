const Event = require('../models/eventModel');
const EventRegistration = require('../models/eventRegistration');
const { apiResponse, fullName } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const { getRolePermissions } = require('../middleware/auth');
const isObjectId = (id) => require('mongoose').isValidObjectId(id);

const normalizeNumber = (num) => {
  if (!num && num !== 0) return '';
  return String(num).trim();
};

const canActOnRegistration = (user, registration, permissions = []) => {
  if (!user) return false;
  if (!registration) return false;

  const isOwner = registration.user && registration.user.id && String(registration.user.id) === String(user._id);
  const emailMatch = registration.email && user.email && String(registration.email).toLowerCase() === String(user.email).toLowerCase();
  const numberMatch = registration.number && user.number && normalizeNumber(registration.number) === normalizeNumber(user.number);
  const privileged = permissions.includes('events.manage') || permissions.includes('users.manage');

  return isOwner || emailMatch || numberMatch || privileged;
};

const findRegistration = (id) => EventRegistration.findOne(
  isObjectId(id) ? { _id: id } : { _id: String(id) }
);

const getUserPayload = (req) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) return { id: null, name: '' };
  return {
    id: String(userId),
    name: fullName(req.user) || ''
  };
};

const formatRegistration = (item = {}) => {
  const user = item.user || {};
  return {
    id: item.id || String(item._id),
    _id: String(item._id),
    name: item.name || '',
    email: item.email || '',
    number: normalizeNumber(item.number || ''),
    total_attendee: item.total_attendee ?? 1,
    status: item.status || 'confirmed',
    event_id: String(item.event_id || ''),
    event_name: item.event_name || '',
    user: {
      id: String(user._id || ''),
      name: user.name || ''
    },
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || ''
  };
};

const registrationPayload = (req, existing = {}, event = {}) => {
  const userPayload = existing.user?.id
    ? existing.user
    : getUserPayload(req);

  return {
    name: req.body.name || existing.name || '',
    email: req.body.email || existing.email || '',
    number: normalizeNumber(req.body.number ?? existing.number ?? ''),
    total_attendee: Number(req.body.total_attendee ?? existing.total_attendee ?? 1),
    event_id: existing.event_id || req.body.event_id || '',
    event_name: existing.event_name || event.event_name || event.title || '',
    user: userPayload
  };
};

const getRegistrationsList = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || '');
    const permissions = req.user ? getRolePermissions(req.user) : [];
    const isPrivileged = permissions.includes('events.manage') || permissions.includes('users.manage');

    let baseQuery = {};
    if (!isPrivileged) {
      const ownedEvents = await Event.find({ 'created_by.id': userId }).select('_id').lean();
      const ownedEventIds = ownedEvents.map((event) => event._id);
      baseQuery = {
        $or: [
          { 'user.id': userId },
          { event_id: { $in: ownedEventIds } }
        ]
      };
    }

    // allow searching by normalized number as well
    const { data, pagination } = await queryHelper(EventRegistration, req.query, {
      baseQuery,
      searchFields: ['name', 'email', 'number', 'event_name'],
      filterFields: ['event_id', 'status']
    });

    return apiResponse(res, 200, 'Registrations retrieved successfully', data.map(formatRegistration), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving registrations', { error: error.message });
  }
};

const getRegistrationById = async (req, res) => {
  try {
    const registration = await findRegistration(req.params.id);
    if (!registration) return apiResponse(res, 404, 'Registration not found');
    // ownership check: only owner or users with event permissions can view
    const user = req.user;
    const permissions = user ? getRolePermissions(user) : [];

    if (!canActOnRegistration(user, registration.toObject(), permissions)) {
      return apiResponse(res, 403, 'Forbidden: You do not have permission to view this registration');
    }

    // include basic event details as ticket
    const event = registration.event_id ? await Event.findById(registration.event_id).lean() : null;
    const payload = formatRegistration(registration.toObject());
    payload.event = event ? {
      id: String(event._id),
      title: event.title || event.event_name || '',
      start_time: event.start_time || null,
      end_time: event.end_time || null,
      location: event.event_location || ''
    } : null;

    payload.ticket = {
      ticket_id: payload.id,
      event_id: payload.event_id,
      event_name: payload.event_name,
      name: payload.name,
      email: payload.email,
      number: payload.number,
      total_attendee: payload.total_attendee,
      status: payload.status
    };

    return apiResponse(res, 200, 'Registration retrieved successfully', payload);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving registration', { error: error.message });
  }
};

const addRegistration = async (req, res) => {
  try {
    const { event_id, email, number } = req.body;
    if (!event_id || !isObjectId(event_id)) return apiResponse(res, 400, 'Valid event_id is required');

    const event = await Event.findById(event_id);
    if (!event) return apiResponse(res, 404, 'Event not found');

    // explicit duplicate checks
    if (email) {
      const emailExists = await EventRegistration.findOne({ event_id, email: email.trim().toLowerCase() })
      if (emailExists) return apiResponse(res, 409, 'This email is already registered for this event')
    }
    if (number) {
      const numberExists = await EventRegistration.findOne({ event_id, number: number.trim() })
      if (numberExists) return apiResponse(res, 409, 'This mobile number is already registered for this event')
    }

    const data = registrationPayload(req, {}, event);
    const registration = new EventRegistration(data);
    await registration.save();
    const formatted = formatRegistration(registration.toObject());

    const ticket = {
      ticket_id: formatted.id,
      event_id: formatted.event_id,
      event_name: formatted.event_name,
      event_title: event?.title || formatted.event_name || '',
      name: formatted.name,
      email: formatted.email,
      number: formatted.number,
      total_attendee: formatted.total_attendee,
      status: formatted.status
    };

    return apiResponse(res, 201, 'Registration saved successfully', { registration: formatted, ticket });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || ''
      if (key.includes('email')) return apiResponse(res, 409, 'This email is already registered for this event')
      if (key.includes('number')) return apiResponse(res, 409, 'This mobile number is already registered for this event')
      return apiResponse(res, 409, 'Already registered for this event')
    }
    return apiResponse(res, 400, error.message || 'Error saving registration')
  }
};

const updateRegistration = async (req, res) => {
  try {
    const registration = await findRegistration(req.params.id);
    if (!registration) return apiResponse(res, 404, 'Registration not found');
    if (registration.status === 'cancelled') return apiResponse(res, 400, 'Cannot update a cancelled registration');

    // only owner or privileged users can update
    const user = req.user;
    const permissions = user ? getRolePermissions(user) : [];
    const isOwner = user && registration.user && registration.user.id && String(registration.user.id) === String(user._id);
    const emailMatch = user && registration.email && user.email && String(registration.email).toLowerCase() === String(user.email).toLowerCase();
    const numberMatch = user && registration.number && user.number && String(registration.number) === String(user.number);

    if (!(isOwner || emailMatch || numberMatch || permissions.includes('events.manage') || permissions.includes('users.manage'))) {
      return apiResponse(res, 403, 'Forbidden: You do not have permission to update this registration');
    }

    registration.set(registrationPayload(req, registration.toObject()));
    await registration.save();
    return apiResponse(res, 200, 'Registration updated successfully', formatRegistration(registration.toObject()));
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || ''
      if (key.includes('email')) return apiResponse(res, 409, 'This email is already registered for this event')
      if (key.includes('number')) return apiResponse(res, 409, 'This mobile number is already registered for this event')
      return apiResponse(res, 409, 'Already registered for this event')
    }
    return apiResponse(res, 400, error.message || 'Error updating registration')
  }
};

const cancelRegistration = async (req, res) => {
  try {
    const registration = await findRegistration(req.params.id);
    if (!registration) return apiResponse(res, 404, 'Registration not found');
    if (registration.status === 'cancelled') return apiResponse(res, 400, 'Registration is already cancelled');

    // only owner or privileged users can cancel
    const user = req.user;
    const permissions = user ? getRolePermissions(user) : [];
    const isOwner = user && registration.user && registration.user.id && String(registration.user.id) === String(user._id);
    const emailMatch = user && registration.email && user.email && String(registration.email).toLowerCase() === String(user.email).toLowerCase();
    const numberMatch = user && registration.number && user.number && String(registration.number) === String(user.number);

    if (!(isOwner || emailMatch || numberMatch || permissions.includes('events.manage') || permissions.includes('users.manage'))) {
      return apiResponse(res, 403, 'Forbidden: You do not have permission to cancel this registration');
    }

    registration.status = 'cancelled';
    await registration.save();
    return apiResponse(res, 200, 'Registration cancelled successfully', formatRegistration(registration.toObject()));
  } catch (error) {
    return apiResponse(res, 500, 'Error cancelling registration', { error: error.message });
  }
};


const downloadRegistrations = async (req, res) => {
  try {
    const { search, event_id } = req.query
    const query = {}

    if (event_id && isObjectId(event_id)) query.event_id = event_id

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$or = [{ name: regex }, { email: regex }, { number: regex }, { event_name: regex }]
    }

    const registrations = await EventRegistration.find(query).sort({ _id: -1 }).lean()

    const rows = registrations.map((r) => ({
      'Name': r.name || '',
      'Email': r.email || '',
      'Phone': r.number || '',
      'Event': r.event_name || '',
      'Entry Type': r.entry_type || 'Free',
      'Total Attendees': Number(r.total_attendee ?? 1),
      'Status': r.status || 'confirmed',
      'Registered By': r.user?.name || 'Guest',
      'Registered On': r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : ''
    }))

    const header = Object.keys(rows[0] || {
      'Name': '', 'Email': '', 'Phone': '', 'Event': '', 'Entry Type': '',
      'Total Attendees': '', 'Status': '', 'Registered By': '', 'Registered On': ''
    })

    const csv = [
      header.join(','),
      ...rows.map((row) => header.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="event-registrations.csv"')
    return res.status(200).send(csv)
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Export failed', error: error.message })
  }
}


module.exports = {
  getRegistrationsList,
  getRegistrationById,
  addRegistration,
  updateRegistration,
  cancelRegistration,
  downloadRegistrations

};