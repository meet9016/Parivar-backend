const express = require('express');
const router = express.Router();

const { loginAdmin, updateAdminRecovery, createAdmin, getAdmins, changePassword } = require('../controllers/adminController');
const { parseForm } = require('../middleware/upload');
const { protect, requirePermission } = require('../middleware/auth');
const roleController = require('../controllers/roleController');
router.post('/register_admin', parseForm, createAdmin);
router.get('/register_admin', getAdmins);
router.get('/get_admins', getAdmins);
router.post('/admin_login', parseForm, loginAdmin);
router.put('/update_admin', parseForm, updateAdminRecovery);
router.post('/change-password', protect, parseForm, changePassword);
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
router.use('/auth', require('./authRoutes')); 
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
router.use('/inquiry', require('./inquiryRoutes'));
router.use('/pricing', require('./pricingRoutes'));

// Dedicated Upload endpoint to upload images to external Digitalks service (https://service.digitalks.co.in)
const { upload } = require('../middleware/upload');
const { uploadToExternalService } = require('../utils/fileUpload');
const { apiResponse } = require('../utils/apiResponse');

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return apiResponse(res, 400, 'No file provided');
    const folder = req.body.folder_structure || req.body.folder || 'members';
    const url = await uploadToExternalService(req.file, folder);
    return apiResponse(res, 200, 'File uploaded successfully', { url, file_url: url });
  } catch (err) {
    return apiResponse(res, 500, err.message || 'Upload failed');
  }
});

module.exports = router;