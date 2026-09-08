const Event = require('../models/eventModel');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const { createAndBroadcast } = require('./notificationController');

const isObjectId = (id) => require('mongoose').isValidObjectId(id);

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (req.body.remove_image === 'true') return '';
  return req.body.image || req.body.image_url || fallback || '';
};

const findEvent = (req, id) => Event.findOne(
  isObjectId(id) ? { _id: id } : { _id: String(id) }
);

const getCreatedByPayload = (req) => ({
  id: String(req.user?.id || req.user?._id || ''),
  name: fullName(req.user) || '',
  
});

const formatEvent = (req, item = {}) => {
  const image = item.image || '';
  const createdBy = item.created_by || {};
  const normalizedCreatedBy = typeof createdBy === 'string'
    ? {
      id: '',
      name: createdBy,
     
    }
    : {
      id: String(createdBy.id || createdBy._id || ''),
      name: createdBy.name || fullName(req.user) || '',
     
    };

  return {
    id: item.id || String(item._id),
    _id: String(item._id),
    title: item.title || '',
    description: item.description || '',
    image: publicUrl(req, image),
    event_category_id: item.event_category_id || '',
    event_category_name: item.event_category_name || '',
    event_name: item.event_name || '',
    event_location: item.event_location || '',
    location_link: item.location_link || '',
    start_time: item.start_time || '',
    end_time: item.end_time || '',
    entry_type: item.entry_type || '',
    country_id: item.country_id || '',
    state_id: item.state_id || '',
    city_id: item.city_id || '',
    country: item.country || '',
    state: item.state || '',
    city: item.city || '',
    status: Number(item.status ?? 1),
    send_notification: item.send_notification !== false,
    target_type: item.target_type || 'all',
    target_users: Array.isArray(item.target_users) ? item.target_users.map(String) : [],
    reminder_sent: !!item.reminder_sent,
    created_by: normalizedCreatedBy
  };
};

const eventPayload = (req, existing = {}) => {
  const title = req.body.title || existing.title || '';
  const description = req.body.description || existing.description || '';

  let target_users = req.body.target_user_ids || req.body.target_users;
  if (typeof target_users === 'string') {
    try {
      target_users = JSON.parse(target_users);
    } catch (_) {
      target_users = target_users.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(target_users)) {
    target_users = existing.target_users || [];
  }

  const send_notification = req.body.send_notification !== undefined
    ? (req.body.send_notification === true || req.body.send_notification === 'true')
    : (existing.send_notification !== undefined ? existing.send_notification : true);

  const target_type = req.body.target_type || req.body.target_audience || existing.target_type || 'all';

  return {
    ...req.body,
    title,
    description,
    event_category_id: req.body.event_category_id || existing.event_category_id || '',
    event_category_name: req.body.event_category_name || existing.event_category_name || '',
    event_name: req.body.event_name || existing.event_name || title,
    event_location: req.body.event_location || existing.event_location || '',
    location_link: req.body.location_link || existing.location_link || '',
    start_time: req.body.start_time || existing.start_time || '',
    end_time: req.body.end_time || existing.end_time || '',
    entry_type: req.body.entry_type || existing.entry_type || '',
    country_id: req.body.country_id || existing.country_id || '',
    state_id: req.body.state_id || existing.state_id || '',
    city_id: req.body.city_id || existing.city_id || '',
    country: req.body.country || existing.country || '',
    state: req.body.state || existing.state || '',
    city: req.body.city || existing.city || '',
    status: Number(req.body.status ?? existing.status ?? 1),
    send_notification,
    target_type,
    target_users,
    reminder_sent: req.body.reminder_sent !== undefined ? Boolean(req.body.reminder_sent) : (existing.reminder_sent || false),
    created_by: existing.created_by || getCreatedByPayload(req),
    image: imageFromRequest(req, existing.image || '')
  };
};

const EventRegistration = require('../models/eventRegistration');

const getEventsList = async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(Event, req.query, {
      searchFields: ['title', 'description', 'event_category_name', 'event_name', 'event_location', 'entry_type'],
      filterFields: ['event_category_id', 'event_category_name', 'entry_type', 'status']
    });

    const mongoose = require('mongoose');
    const eventIds = data.map(item => item._id || item.id);
    const objectIds = eventIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(String(id)));
    const stringIds = eventIds.map(id => String(id));

    // Aggregate attendees count per event
    const registrationStats = await EventRegistration.aggregate([
      { 
        $match: { 
          event_id: { $in: [...objectIds, ...stringIds] },
          status: { $ne: 'cancelled' }
        } 
      },
      {
        $group: {
          _id: { $toString: '$event_id' },
          total_registrations: { $sum: 1 },
          total_attendees: { $sum: { $ifNull: ['$total_attendee', 1] } }
        }
      }
    ]);

    const statsMap = {};
    registrationStats.forEach(stat => {
      statsMap[String(stat._id)] = {
        total_registrations: stat.total_registrations || 0,
        total_attendees: stat.total_attendees || 0
      };
    });

    const formatted = data.map((item) => {
      const idStr = String(item._id || item.id);
      const stats = statsMap[idStr] || { total_registrations: 0, total_attendees: 0 };
      const formattedItem = formatEvent(req, item);
      const attendeeCount = Number(stats.total_attendees || stats.total_registrations || 0);
      return {
        ...formattedItem,
        total_registrations: attendeeCount,
        total_attendees: attendeeCount,
        registration_count: Number(stats.total_registrations || 0)
      };
    });

    return apiResponse(res, 200, 'Events retrieved successfully', formatted, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving events', { error: error.message });
  }
};

const addEvent = async (req, res) => {
  try {
    const data = eventPayload(req);
    const event = new Event(data);
    await event.save();

    // Send push notification if requested
    if (req.body.send_notification !== 'false' && req.body.send_notification !== false) {
      const imageUrl = event.image ? publicUrl(req, event.image) : '';
      const eventDate = event.start_time || event.event_date || event.createdAt || '';
      const target_type = req.body.target_type || req.body.target_audience || 'all';
      const target_users = req.body.target_user_ids || req.body.target_users || [];

      createAndBroadcast({
        title: `New Event: ${event.title}`,
        body: event.description?.slice(0, 150) || `Join us for ${event.title}!`,
        image: imageUrl,
        type: 'event',
        ref_id: String(event._id),
        date: eventDate,
        event_location: event.event_location || '',
        target_type,
        target_users
      });
    }

    return apiResponse(res, 201, 'Event saved successfully', formatEvent(req, event.toObject()));
  } catch (error) {
    return apiResponse(res, 400, error.message || 'Error saving event');
  }
};


const updateEvent = async (req, res) => {
  try {
    const event = await findEvent(req, req.params.id);
    if (!event) {
      return apiResponse(res, 404, 'Event not found');
    }
    event.set(eventPayload(req, event));
    await event.save();
    return apiResponse(res, 200, 'Event saved successfully', formatEvent(req, event.toObject()));
  } catch (error) {
    return apiResponse(res, 400, error.message || 'Error saving event');
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await findEvent(req, req.params.id);
    if (!event) {
      return apiResponse(res, 404, 'Event not found');
    }
    await event.deleteOne();
    return apiResponse(res, 200, 'Event deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting event', { error: error.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await findEvent(req, req.params.id);
    if (!event) {
      return apiResponse(res, 404, 'Event not found');
    }
    return apiResponse(res, 200, 'Event retrieved successfully', formatEvent(req, event.toObject()));
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving event', { error: error.message });
  }
};

const bulkUpdateEventStatus = async (req, res) => {
  try {
    const { eventIds, status } = req.body;
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return apiResponse(res, 400, 'eventIds not found');
    }

    const mongoose = require('mongoose');
    const objectIds = eventIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(String(id)));
    const stringIds = eventIds.map(id => String(id));

    await Event.updateMany(
      { $or: [{ _id: { $in: objectIds } }, { id: { $in: stringIds } }] },
      { $set: { status: Number(status) } }
    );
    return apiResponse(res, 200, 'Events status updated successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error updating events', { error: error.message });
  }
};

const bulkDeleteEvents = async (req, res) => {
  try {
    const eventIds = req.body.eventIds || req.body.ids;
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return apiResponse(res, 400, 'eventIds not found');
    }

    const mongoose = require('mongoose');
    const objectIds = eventIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(String(id)));
    const stringIds = eventIds.map(id => String(id));

    await Event.deleteMany(
      { $or: [{ _id: { $in: objectIds } }, { id: { $in: stringIds } }] }
    );
    return apiResponse(res, 200, 'Events deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting events', { error: error.message });
  }
};

module.exports = {
  getEventsList,
  getEventById,
  addEvent,
  updateEvent,
  deleteEvent,
  bulkUpdateEventStatus,
  bulkDeleteEvents
};
