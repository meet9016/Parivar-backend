const Event = require('../models/eventModel');
const Country = require('../models/countryModel');
const State = require('../models/stateModel');
const City = require('../models/cityModel');
const Master = require('../models/masterModel');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const { getRolePermissions } = require('../middleware/auth');
const queryHelper = require('../utils/queryHelper');
const { createAndBroadcast } = require('./notificationController');

const isObjectId = (id) => require('mongoose').isValidObjectId(id);

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (req.body.remove_image === 'true') return '';
  return req.body.image || req.body.image_url || fallback || '';
};

const findEvent = (req, id) => {
  const mongoose = require('mongoose');
  const conditions = [{ id: String(id) }];
  if (mongoose.isValidObjectId(id)) {
    conditions.push({ _id: new mongoose.Types.ObjectId(String(id)) });
  }
  conditions.push({ _id: String(id) });
  return Event.findOne({ $or: conditions });
};

const getCreatedByPayload = (req) => ({
  id: String(req.user?.id || req.user?._id || ''),
  name: fullName(req.user) || '',
});

const resolveLocationMaps = async (events = []) => {
  const countryIds = new Set();
  const stateIds = new Set();
  const districtIds = new Set();
  const cityIds = new Set();

  events.forEach(e => {
    if (e.country_id) countryIds.add(String(e.country_id));
    if (e.state_id) stateIds.add(String(e.state_id));
    if (e.district_id) districtIds.add(String(e.district_id));
    if (e.city_id) cityIds.add(String(e.city_id));
  });

  const mongoose = require('mongoose');
  const toQuery = (ids) => {
    const arr = Array.from(ids);
    const objIds = arr.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(String(id)));
    return { $or: [{ _id: { $in: [...objIds, ...arr] } }, { id: { $in: arr } }] };
  };

  const [countries, states, districts, cities] = await Promise.all([
    countryIds.size ? Country.find(toQuery(countryIds)).lean().catch(() => []) : [],
    stateIds.size ? State.find(toQuery(stateIds)).lean().catch(() => []) : [],
    districtIds.size ? Master.find({ ...toQuery(districtIds), type: 'district' }).lean().catch(() => []) : [],
    cityIds.size ? City.find(toQuery(cityIds)).lean().catch(() => []) : []
  ]);

  const countryMap = new Map();
  countries.forEach(c => {
    const val = c.name || c.country || c.title || '';
    if (c._id) countryMap.set(String(c._id), val);
    if (c.id) countryMap.set(String(c.id), val);
  });

  const stateMap = new Map();
  states.forEach(s => {
    const val = s.name || s.state || s.title || '';
    if (s._id) stateMap.set(String(s._id), val);
    if (s.id) stateMap.set(String(s.id), val);
  });

  const districtMap = new Map();
  districts.forEach(d => {
    const val = d.name || d.district || d.title || '';
    if (d._id) districtMap.set(String(d._id), val);
    if (d.id) districtMap.set(String(d.id), val);
  });

  const cityMap = new Map();
  cities.forEach(c => {
    const val = c.name || c.city || c.title || '';
    if (c._id) cityMap.set(String(c._id), val);
    if (c.id) cityMap.set(String(c.id), val);
  });

  return { countryMap, stateMap, districtMap, cityMap };
};

const formatEvent = (req, item = {}, extra = {}) => {
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

  const countryId = String(item.country_id || '');
  const stateId = String(item.state_id || '');
  const districtId = String(item.district_id || '');
  const cityId = String(item.city_id || '');

  const countryName = extra.country_name || (extra.countryMap && extra.countryMap.get(countryId)) || item.country_name || item.country || '';
  const stateName = extra.state_name || (extra.stateMap && extra.stateMap.get(stateId)) || item.state_name || item.state || '';
  const districtName = extra.district_name || (extra.districtMap && extra.districtMap.get(districtId)) || item.district_name || item.district || '';
  const cityName = extra.city_name || (extra.cityMap && extra.cityMap.get(cityId)) || item.city_name || item.city || '';

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
    country_id: countryId,
    country: countryName,
    country_name: countryName,
    state_id: stateId,
    state: stateName,
    state_name: stateName,
    district_id: districtId,
    district: districtName,
    district_name: districtName,
    city_id: cityId,
    city: cityName,
    city_name: cityName,
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

  const country_id = req.body.country_id || existing.country_id || '';
  const state_id = req.body.state_id || existing.state_id || '';
  const district_id = req.body.district_id || existing.district_id || '';
  const city_id = req.body.city_id || existing.city_id || '';

  const country = req.body.country || req.body.country_name || existing.country || existing.country_name || '';
  const state = req.body.state || req.body.state_name || existing.state || existing.state_name || '';
  const district = req.body.district || req.body.district_name || existing.district || existing.district_name || '';
  const city = req.body.city || req.body.city_name || existing.city || existing.city_name || '';

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
    country_id,
    country,
    country_name: country,
    state_id,
    state,
    state_name: state,
    district_id,
    district,
    district_name: district,
    city_id,
    city,
    city_name: city,
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
      searchFields: ['title', 'description', 'event_category_name', 'event_name', 'event_location', 'entry_type', 'city', 'district', 'state', 'country'],
      filterFields: ['event_category_id', 'event_category_name', 'entry_type', 'status', 'country_id', 'state_id', 'district_id', 'city_id']
    });

    const mongoose = require('mongoose');
    const eventIds = data.map(item => item._id || item.id);
    const objectIds = eventIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(String(id)));
    const stringIds = eventIds.map(id => String(id));

    // Aggregate attendees count per event
    const [registrationStats, maps] = await Promise.all([
      EventRegistration.aggregate([
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
      ]),
      resolveLocationMaps(data)
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
      const formattedItem = formatEvent(req, item, maps);
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

    const maps = await resolveLocationMaps([event.toObject()]);
    return apiResponse(res, 201, 'Event saved successfully', formatEvent(req, event.toObject(), maps));
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

    const permissions = getRolePermissions(req.user);
    const isAdmin = req.user?.committee_role === 'President' || permissions.includes('events.edit') || !!req.user?.role_id;
    const currentUserId = String(req.user?.id || req.user?._id || '');
    const eventCreatedById = String(event.created_by?.id || event.created_by?._id || (typeof event.created_by === 'string' ? event.created_by : ''));

    if (!isAdmin && eventCreatedById && eventCreatedById !== currentUserId) {
      return apiResponse(res, 403, 'Unauthorized - You can only edit your own events');
    }

    event.set(eventPayload(req, event));
    await event.save();
    const maps = await resolveLocationMaps([event.toObject()]);
    return apiResponse(res, 200, 'Event saved successfully', formatEvent(req, event.toObject(), maps));
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

    const permissions = getRolePermissions(req.user);
    const isAdmin = req.user?.committee_role === 'President' || permissions.includes('events.delete') || !!req.user?.role_id;
    const currentUserId = String(req.user?.id || req.user?._id || '');
    const eventCreatedById = String(event.created_by?.id || event.created_by?._id || (typeof event.created_by === 'string' ? event.created_by : ''));

    if (!isAdmin && eventCreatedById && eventCreatedById !== currentUserId) {
      return apiResponse(res, 403, 'Unauthorized - You can only delete your own events');
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
    const maps = await resolveLocationMaps([event.toObject()]);
    return apiResponse(res, 200, 'Event retrieved successfully', formatEvent(req, event.toObject(), maps));
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
