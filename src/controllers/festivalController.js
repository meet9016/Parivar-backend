const mongoose = require('mongoose');
const Festival = require('../models/festivalModel');
const { apiResponse, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const isObjectId = (id) => mongoose.isValidObjectId(id);

const nextPublicId = async (prefix = '') => {
  const count = await Festival.countDocuments();
  return `${prefix}${Date.now()}${count}`;
};

const findById = (id, extraQuery = {}) => Festival.findOne({
  ...extraQuery,
  $or: [
    { id: String(id) },
    ...(isObjectId(id) ? [{ _id: id }] : [])
  ]
});

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (Array.isArray(req.body.images) && req.body.images[0]) return req.body.images[0];
  return req.body.image || req.body.image_url || fallback || '';
};

// --- Member ---
const getFestivals = async (req, res) => {
  try {
    const { data: festivals, pagination } = await queryHelper(Festival, req.query, {
      searchFields: ['title', 'description', 'festival_name', 'description', ],
      filterFields: ['status']
    });
    const data = festivals.map((festival) => ({
      id: festival.id || String(festival._id),
      festival_name: festival.festival_name || festival.title || '',
      festival_date: festival.festival_date || festival.date || '',
      description: festival.description ||  '',
      image: publicUrl(req, festival.image || '')
    }));

    return apiResponse(res, 200, 'Festivals Data fetch successful', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving festivals', { error: error.message });
  }
};

// --- Admin ---
const formatFestival = (req, item) => ({
  id: item.id || String(item._id),
  title: item.title || item.festival_name || '',
  description: item.description  || '',
  festival_name: item.festival_name || item.title || '',
  festival_date: item.festival_date || item.date || '',

  status: Number(item.status ?? 1),
  image: publicUrl(req, item.image || '')
});

const adminGetFestivals = async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(Festival, req.query, {
      searchFields: ['title', 'description', 'festival_name', 'description',],
      filterFields: ['status']
    });
    return apiResponse(res, 200, 'Festivals retrieved successfully', data.map((row) => formatFestival(req, row)), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving festivals', { error: error.message });
  }
};

const getFestivalById = async (req, res) => {
  try {
    const doc = await findById(req.params.id, {});
    if (!doc) return apiResponse(res, 404, 'Festival not found');
    return apiResponse(res, 200, 'Festival retrieved successfully', formatFestival(req, doc.toObject()));
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving festival', { error: error.message });
  }
};

const saveFestival = async (req, res) => {
  try {
    const existing = req.params.id ? await findById(req.params.id, {}) : null;
    
    const title = req.body.title || req.body.festival_name || existing?.title || existing?.festival_name || '';
    const description = req.body.description || req.body.description || existing?.description || existing?.description || '';
    
    const payload = {
      ...req.body,
      title,
      description,
      festival_name: req.body.festival_name || title,
      description: req.body.description || description,
      image: imageFromRequest(req, existing?.image)
    };

    if (!payload.title) {
      return apiResponse(res, 400, 'Festival title is required');
    }

    if (!payload.description) {
      return apiResponse(res, 400, 'Festival description is required');
    }

    const doc = existing || new Festival({ id: await nextPublicId('FST') });
    delete payload.images;
    doc.set({ ...payload });

    if (!existing) {
      doc.status = req.body.status !== undefined ? Number(req.body.status) : 1;
    } else if (req.body.status !== undefined) {
      doc.status = Number(req.body.status);
    }
    
    await doc.save();

    return apiResponse(res, existing ? 200 : 201, 'Festival saved successfully', formatFestival(req, doc.toObject()));
  } catch (error) {
    return apiResponse(res, 500, 'Error saving festival', { error: error.message });
  }
};

const deleteFestival = async (req, res) => {
  try {
    const existing = await findById(req.params.id, {});
    if (!existing) return apiResponse(res, 404, 'Festival not found');
    await existing.deleteOne();
    return apiResponse(res, 200, 'Festival deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting festival', { error: error.message });
  }
};

module.exports = {
  getFestivals,
  adminGetFestivals,
  getFestivalById,
  saveFestival,
  deleteFestival
};
