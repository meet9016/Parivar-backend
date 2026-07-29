const express = require('express');
const adminContent = require('../controllers/adminContentController');
const adminController = require('../controllers/adminController');
const festivalController = require('../controllers/festivalController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

// Festival routes are now moved directly to routes/admin/festivalRoutes.js
// Alias content routes for festivals and students so they can also be accessed under /admin/content
router.get('/festivals', festivalController.adminGetFestivals);
router.get('/festivals/:id', protect, requirePermission('festivals.list'), festivalController.getFestivalById);
router.post('/festivals', protect, requirePermission('festivals.add'), parseForm, festivalController.saveFestival);
router.put('/festivals/:id', protect, requirePermission('festivals.edit'), parseForm, festivalController.saveFestival);
router.delete('/festivals/:id', protect, requirePermission('festivals.delete'), festivalController.deleteFestival);



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
