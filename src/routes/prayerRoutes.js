const express = require('express');
const router = express.Router();
const { getPrayerTimes, updatePrayerTimes } = require('../controllers/prayerController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

// Public read access to prayer timetable
router.get('/', getPrayerTimes);

// Admin update access
router.put('/', protect, requirePermission('settings.edit'), parseForm, updatePrayerTimes);
router.post('/', protect, requirePermission('settings.edit'), parseForm, updatePrayerTimes);

module.exports = router;
