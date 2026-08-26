const express = require('express');
const router = express.Router();
const { createInquiry, getInquiries, updateInquiryStatus } = require('../controllers/inquiryController');

// POST /api/inquiry — Public: anyone can submit inquiry
router.post('/', createInquiry);

// GET /api/inquiry — Superadmin / Public listing
router.get('/', getInquiries);

// PUT /api/inquiry/:id — Update status (pending/resolved)
router.put('/:id', updateInquiryStatus);

module.exports = router;
