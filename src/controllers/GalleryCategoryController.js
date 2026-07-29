const mongoose = require('mongoose');
const GalleryCategory = require('../models/galleryCategoryModel');
const { apiResponse } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const isAdminUser = (user = {}) => Boolean(user?.committee_role === 'President' || user?.role_id);

const idQuery = (id) => ({
  $or: [
    { id: String(id) },
    ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : [])
  ]
});

let legacyIndexChecked = false;

const dropLegacyUniqueCategoryIndex = async () => {
  if (legacyIndexChecked) return;
  legacyIndexChecked = true;

  try {
    const indexes = await GalleryCategory.collection.indexes();
    const legacyIndex = indexes.find((index) => index.name === 'category_1' && index.unique);
    if (legacyIndex) {
      await GalleryCategory.collection.dropIndex('category_1');
    }
  } catch (error) {
    if (!['IndexNotFound', 'NamespaceNotFound'].includes(error.codeName)) {
      throw error;
    }
  }
};

const formatCategory = (item) => ({
  id: item.id || String(item._id),
  category: item.category
});

const getCategories = async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(GalleryCategory, req.query, {
      searchFields: ['category'],
      filterFields: ['category'],
      defaultSort: { category: 1 }
    });
    return apiResponse(res, 200, 'Gallery categories retrieved successfully', data.map(formatCategory), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving gallery categories', { error: error.message });
  }
};

const saveCategory = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return apiResponse(res, 403, 'Forbidden: Admin only');
    }
    const categoryText = (req.body.category || '').trim();
    if (!categoryText) {
      return apiResponse(res, 400, 'Category name is required');
    }

    await dropLegacyUniqueCategoryIndex();

    const existing = req.params.id
      ? await GalleryCategory.findOne(idQuery(req.params.id))
      : null;

    const duplicate = await GalleryCategory.findOne({

      category: categoryText,
      ...(existing ? { _id: { $ne: existing._id } } : {})
    });

    if (duplicate) {
      return apiResponse(res, 400, 'Gallery category already exists');
    }

    const doc = existing || new GalleryCategory();
    doc.category = categoryText;
    await doc.save();

    return apiResponse(res, existing ? 200 : 201, 'Gallery category saved successfully', formatCategory(doc.toObject()));
  } catch (error) {
    if (error.code === 11000) {
      return apiResponse(res, 400, 'Gallery category already exists');
    }
    return apiResponse(res, 500, 'Error saving gallery category', { error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return apiResponse(res, 403, 'Forbidden: Admin only');
    }

    const existing = await GalleryCategory.findOne({
      ...idQuery(req.params.id)
    });
    if (!existing) return apiResponse(res, 404, 'Gallery category not found');
    await existing.deleteOne();
    return apiResponse(res, 200, 'Gallery category deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting gallery category', { error: error.message });
  }
};

module.exports = {
  getCategories,
  saveCategory,
  deleteCategory
};
