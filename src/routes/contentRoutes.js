const express = require('express');
const multer = require('multer');
const adminContent = require('../controllers/adminContentController');
const adminController = require('../controllers/adminController');
const festivalController = require('../controllers/festivalController');
const suvicharController = require('../controllers/suvicharController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const uploadMemory = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Festival routes
router.get('/festivals', festivalController.adminGetFestivals);
router.get('/festivals/:id', protect, requirePermission('festivals.list'), festivalController.getFestivalById);
router.post('/festivals', protect, requirePermission('festivals.add'), parseForm, festivalController.saveFestival);
router.put('/festivals/:id', protect, requirePermission('festivals.edit'), parseForm, festivalController.saveFestival);
router.delete('/festivals/:id', protect, requirePermission('festivals.delete'), festivalController.deleteFestival);

// Suvichar routes
router.get('/suvichar', suvicharController.adminGetSuvichars);
router.post('/suvichar/bulk-import', protect, requirePermission('suvichar.add'), uploadMemory.single('file'), suvicharController.bulkImportSuvichars);
router.post('/suvichar/bulk-duplicate', protect, requirePermission('suvichar.add'), suvicharController.bulkDuplicateSuvichars);
router.post('/suvichar/bulk-create', protect, requirePermission('suvichar.add'), parseForm, suvicharController.saveSuvichar);
router.post('/suvichar/:id/duplicate', protect, requirePermission('suvichar.add'), suvicharController.duplicateSuvichar);
router.get('/suvichar/:id', protect, requirePermission('suvichar.list'), suvicharController.getSuvicharById);
router.post('/suvichar', protect, requirePermission('suvichar.add'), parseForm, suvicharController.saveSuvichar);
router.put('/suvichar/:id', protect, requirePermission('suvichar.edit'), parseForm, suvicharController.saveSuvichar);
router.delete('/suvichar/:id', protect, requirePermission('suvichar.delete'), suvicharController.deleteSuvichar);

// Banner routes
router.get('/banners', protect, requirePermission('banners.list'), adminContent.getBanners);
router.post('/banners', protect, requirePermission('banners.add'), parseForm, adminContent.saveBanner);
router.put('/banners/:id', protect, requirePermission('banners.edit'), parseForm, adminContent.saveBanner);
router.delete('/banners/:id', protect, requirePermission('banners.delete'), adminContent.deleteBanner);

// Contact inquiry routes
router.get('/contact-inquiries', protect, requirePermission('contact-inquiries.list'), adminContent.getInquiries);
router.post('/contact-inquiries', protect, requirePermission('contact-inquiries.edit'), parseForm, adminContent.saveInquiry);
router.put('/contact-inquiries/:id', protect, requirePermission('contact-inquiries.edit'), parseForm, adminContent.saveInquiry);
router.delete('/contact-inquiries/:id', protect, requirePermission('contact-inquiries.delete'), adminContent.deleteInquiry);

module.exports = router;
