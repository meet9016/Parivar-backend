const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getGallery ,saveGallery ,deleteGallery} = require('../controllers/GalleryController');

const router = express.Router();

router.get('/',   getGallery);
router.post('/', protect, requirePermission('gallery.add'), parseForm,saveGallery);
router.put('/:id', protect, requirePermission('gallery.edit'), parseForm,saveGallery);
router.delete('/:id', protect, requirePermission('gallery.delete'),deleteGallery);

module.exports = router;
