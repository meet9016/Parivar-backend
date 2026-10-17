const express = require('express');


const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getConfig, updateConfig, testScheduledPush } = require('../controllers/configController');

const router = express.Router();

router.get('/',  getConfig);

router.post('/test_push', protect, requirePermission('settings.edit'), testScheduledPush);
router.put('/', protect, requirePermission('settings.edit'), parseForm, updateConfig);
router.post('/', protect, requirePermission('settings.edit'), parseForm, updateConfig);

module.exports = router;
