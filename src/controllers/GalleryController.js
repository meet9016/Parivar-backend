const mongoose = require('mongoose');
const Gallery = require('../models/galleryModel');

const { apiResponse, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const isObjectId = (id) => mongoose.isValidObjectId(id);

const nextPublicId = async (Model, prefix = '') => {
  const count = await Model.countDocuments();
  return `${prefix}${Date.now()}${count}`;
};

const findById = (Model, id, extraQuery = {}) => Model.findOne({
  ...extraQuery,
  $or: [
    { id: String(id) },
    ...(isObjectId(id) ? [{ _id: id }] : [])
  ]
});

const normalizeArrayField = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null && item !== '')
  return value ? [value] : []
};

const storedImagePath = (value = '') => {
  if (!value) return '';
  const text = String(value);
  const uploadIndex = text.indexOf('/uploads/');
  if (uploadIndex >= 0) return text.slice(uploadIndex);
  return text;
};

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatMonthName = (val) => {
  if (!val) return '';
  const text = String(val).trim();
  const num = parseInt(text, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return MONTH_NAMES[num];
  }
  const match = MONTH_NAMES.find(m => m && m.toLowerCase() === text.toLowerCase());
  if (match) return match;
  return text;
};

const galleryPayload = (req, existing = {}) => {

  const hasImageFields = Object.prototype.hasOwnProperty.call(req.body, 'existing_images')
    || Object.prototype.hasOwnProperty.call(req.body, 'images')
    || Object.prototype.hasOwnProperty.call(req.body, 'image');
  const existingImages = normalizeArrayField(req.body.existing_images).map(storedImagePath)
  const uploadedImages = [
    ...normalizeArrayField(req.body.images),
    ...normalizeArrayField(req.body.image)
  ].map(storedImagePath)
  const images = hasImageFields
    ? [...existingImages, ...uploadedImages]
    : normalizeArrayField(existing.images).map(storedImagePath);

  let year = req.body.year !== undefined ? String(req.body.year) : (existing.year || '');
  let month = req.body.month !== undefined ? String(req.body.month) : (existing.month || '');

  if (year && year.includes('-') && !req.body.month) {
    const parts = year.split('-');
    if (parts.length === 2) {
      year = parts[0];
      month = parts[1];
    }
  }

  month = formatMonthName(month);

  return {
    ...req.body,
    images,
    year,
    month,
    gallery_category_id: String(req.body.gallery_category_id || existing.gallery_category_id || ''),
    status: req.body.status !== undefined ? Number(req.body.status) : (existing.status !== undefined ? Number(existing.status) : 1)
  };
};

const formatGallery = (req, item) => {
  let year = item.year || '';
  let month = item.month || '';
  if ((!year || !month) && item.createdAt) {
    const d = new Date(item.createdAt);
    if (!isNaN(d.getTime())) {
      if (!year) year = String(d.getFullYear());
      if (!month) month = String(d.getMonth() + 1).padStart(2, '0');
    }
  }

  const formattedMonth = formatMonthName(month);

  return {
    id: item.id || String(item._id),
    _id: item._id,
    images: Array.isArray(item.images) ? item.images.map(img => publicUrl(req, img)) : [],
    year: String(year || ''),
    month: formattedMonth,
    category: item.category || 'General',
    gallery_category_id: String(item.gallery_category_id || ''),
    status: item.status !== undefined ? Number(item.status) : 1
  };
};

const getGallery = async (req, res) => {

  try {
    const { data, pagination } = await queryHelper(Gallery, req.query, {
      searchFields: ['category', 'year', 'month'],
      filterFields: ['category', 'year', 'month', 'gallery_category_id', 'status']
    });
    return apiResponse(res, 200, 'Gallery retrieved successfully', data.map((row) => formatGallery(req, row)), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving gallery', { error: error.message });
  }
};

const saveGallery = async (req, res) => {
  try {
    const existing = req.params.id ? await findById(Gallery, req.params.id) : null;
    const payload = galleryPayload(req, existing || {});

    const hasImages = Array.isArray(payload.images) && payload.images.length > 0;
    if (!hasImages && !existing) {
      return apiResponse(res, 400, 'Gallery images are required');
    }

    const doc = existing || new Gallery({});
    doc.set({ ...payload,  });


    await doc.save();
    return apiResponse(res, existing ? 200 : 201, 'Gallery saved successfully', formatGallery(req, doc.toObject()));
  } catch (error) {
    return apiResponse(res, 500, 'Error saving gallery', { error: error.message });
  }
};

const deleteGallery = async (req, res) => {
  try {
    const existing = await findById(Gallery, req.params.id);
    if (!existing) return apiResponse(res, 404, 'Gallery not found');
    await existing.deleteOne();
    return apiResponse(res, 200, 'Gallery deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting gallery', { error: error.message });
  }
};

module.exports = {
  getGallery,
  saveGallery,
  deleteGallery
};
