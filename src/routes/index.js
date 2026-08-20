const express = require('express');
const router = express.Router();

const { loginAdmin, updateAdminRecovery, createAdmin } = require('../controllers/adminController');
const { parseForm } = require('../middleware/upload');
const { protect, requirePermission } = require('../middleware/auth');
const roleController = require('../controllers/roleController');

// Admin Only Routes (previously under /api/admin)
// Now exposed at /api/ directly but still protected by permissions.
router.post('/register_admin', parseForm, createAdmin);
router.post('/admin_login', parseForm, loginAdmin);
router.put('/update_admin', parseForm, updateAdminRecovery);


// Unified Routes we updated
router.use('/users', require('./userRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/students', require('./studentRoutes'));
router.use('/matrimonies', require('./matrimonyRoutes'));
router.use('/festivals', require('./festivalRoutes'));
router.use('/donations', require('./donationRoutes'));
router.use('/posts', require('./postRoutes'));
router.use('/news', require('./newsRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/expenses', require('./expenseRoutes'));

// Member/General Shared Routes
router.use('/auth', require('./authRoutes')); // Normal member auth
router.use('/directory', require('./directoryRoutes'));
router.use('/gallery', require('./galleryRoutes'));
router.use('/gallery-categories', require('./galleryCategoryRoutes'));
router.use('/businesses', require('./businessRoutes'));
router.use('/feedback', require('./feedbackRoutes'));
router.use('/job-vacancy', require('./jobVacancyRoutes'));
router.use('/committee-members', require('./committeeMemberRoutes'));
router.use('/event-registrations', require('./eventRegistrationRoutes'));
router.use('/event_registrations', require('./eventRegistrationRoutes'));
router.use('/get_app_theme', require('./configRoutes'));
router.use('/update_app_theme', require('./configRoutes'));



router.use('/stats', require('./dashboardRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.get('/permissions', protect, requirePermission('roles.list'), roleController.getPermissionOptions);
router.use('/roles', require('./roleRoutes'));
router.use('/business-categories', require('./businessCategoryRoutes'));
router.use('/bank-details', require('./bankDetailRoutes'));
router.use('/content', require('./contentRoutes'));
router.use('/masters', require('./masterRoutes'));

// Note: For backwards compatibility with member API, we also mount some of these directly
// to match member/index.js legacy structure if needed, but the above uses are sufficient.

module.exports = router;
