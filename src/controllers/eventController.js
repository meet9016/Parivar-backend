const Event = require('../models/eventModel');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

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
    created_by: normalizedCreatedBy
  };
};

const eventPayload = (req, existing = {}) => {
  const title = req.body.title || existing.title || '';
  const description = req.body.description || existing.description || '';

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
    created_by: existing.created_by || getCreatedByPayload(req),
    image: imageFromRequest(req, existing.image || '')
  };
};

const getEventsList = async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(Event, req.query, {
      searchFields: ['title', 'description', 'event_category_name', 'event_name', 'event_location', 'entry_type'],
      filterFields: ['event_category_id', 'event_category_name', 'entry_type']
    });
    return apiResponse(res, 200, 'Events retrieved successfully', data.map((item) => formatEvent(req, item)), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving events', { error: error.message });
  }
};

const addEvent = async (req, res) => {
  try {
    const data = eventPayload(req);
    const event = new Event(data);
    await event.save();
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

module.exports = {
  getEventsList,
  getEventById,
  addEvent,
  updateEvent,
  deleteEvent
};
