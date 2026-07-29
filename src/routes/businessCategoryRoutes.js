const express = require('express');

const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getBusinessCategoryList } = require('../controllers/businessController');

const router = express.Router();


router.get('/', getBusinessCategoryList);

module.exports = router;
