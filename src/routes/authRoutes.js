const express = require('express');
// const { login } = require('../controllers/adminController');
const { parseForm } = require('../middleware/upload');
const { login } = require('../controllers/authController');

const router = express.Router();

router.post('/', parseForm, login);


module.exports = router;
