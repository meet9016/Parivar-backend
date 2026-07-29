const express = require('express');


const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getConfig, updateConfig } = require('../controllers/configController');

const router = express.Router();

router.get('/',  getConfig);

router.put('/', protect, requirePermission('settings.edit'), parseForm, updateConfig);
router.post('/', protect, requirePermission('settings.edit'), parseForm, updateConfig);


module.exports = router;
