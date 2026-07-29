const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getCategories, saveCategory, deleteCategory } = require('../controllers/GalleryCategoryController');

const router = express.Router();

router.get('/',  getCategories);
router.post('/', protect, requirePermission('gallery.add'), parseForm, saveCategory);
router.put('/:id', protect, requirePermission('gallery.edit'), parseForm, saveCategory);
router.delete('/:id', protect, requirePermission('gallery.delete'), deleteCategory);

module.exports = router;
