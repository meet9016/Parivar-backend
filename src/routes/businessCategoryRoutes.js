const express = require('express');
const { getBusinessCategoryList } = require('../controllers/businessController');

const router = express.Router();

router.get('/', getBusinessCategoryList);

module.exports = router;
