const Post = require('../models/postModel');
const Event = require('../models/eventModel');
const Festival = require('../models/festivalModel');
const Gallery = require('../models/galleryModel');
const User = require('../models/userModels');
const { apiResponse, fullName, memberPublicId, publicUrl, toArchiveDate } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const currentMemberId = (req) => memberPublicId(req.user || {});

const getHome = async (req, res) => {
  return apiResponse(res, 200, 'Home Data fetch successful', {
    banner: []
  });
};

const getGallery = async (req, res) => {
  try {
    const { data: images, pagination } = await queryHelper(Gallery, req.query, {
      searchFields: ['category', 'year'],
      filterFields: ['category', 'year', 'gallery_category_id']
    });
    const byYear = new Map();

    images.forEach((item) => {
      const year = String(item.year || new Date(item.createdAt || Date.now()).getFullYear());
      const categoryId = String(item.gallery_category_id || item.category_id || item.category || 'General');
      const categoryName = item.event_category || item.category_name || item.category || 'General';

      if (!byYear.has(year)) {
        byYear.set(year, {
          year,
          categories: new Map()
        });
      }

      const yearGroup = byYear.get(year);
      if (!yearGroup.categories.has(categoryId)) {
        yearGroup.categories.set(categoryId, {
          gallery_category_id: categoryId,
          category_name: categoryName,
          images: []
        });
      }

      const galleryImages = Array.isArray(item.images) && item.images.length
        ? item.images
        : [item.image].filter(Boolean);

      galleryImages.forEach((image, index) => {
        yearGroup.categories.get(categoryId).images.push({
          id: `${item.id || String(item._id)}-${index}`,
          image: publicUrl(req, image || '')
        });
      });
    });

    const data = Array.from(byYear.values()).map((yearGroup) => ({
      year: yearGroup.year,
      categories: Array.from(yearGroup.categories.values())
    }));

    return apiResponse(res, 200, 'Gallery Data fetch successful', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving gallery', { error: error.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const { data: events, pagination } = await queryHelper(Event, req.query, {
      searchFields: ['title', 'description', 'event_category_name', 'event_name', 'event_location', 'entry_type'],
      filterFields: ['event_category_id', 'event_category_name', 'entry_type']
    });
    const data = events.map((event) => ({
      id: event.id || String(event._id),
      event_category_id: event.event_category_id || '',
      event_category_name: event.event_category_name || event.category || '',
      event_name: event.event_name || event.title || '',
      event_location: event.event_location || event.venue || '',
      location_link: event.location_link || '',
      timing: `${toArchiveDate(event.start_time ||  event.date)} - ${toArchiveDate(event.end_time || event.date)}`,
      entry_type: event.entry_type || '',
      event_description: event.event_description || event.description || '',
      image: publicUrl(req, event.image || '')
    }));

    return apiResponse(res, 200, 'Events Data fetch successful', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving events', { error: error.message });
  }
};





module.exports = {
  getHome,
  getGallery,
  getEvents
};
