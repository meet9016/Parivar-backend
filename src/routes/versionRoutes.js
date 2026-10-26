const express = require('express');
const { getVersion } = require('../controllers/versionController');

const router = express.Router();

// Only GET endpoint for app version
router.get('/', getVersion);

module.exports = router;
