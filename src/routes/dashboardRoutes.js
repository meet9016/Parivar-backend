const express = require('express');
const { getStats } = require('../controllers/adminController');
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, requirePermission('dashboard.view'), getStats);

module.exports = router;
