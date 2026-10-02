const express = require('express');
const router = express.Router();
const {
  getCertificates,
  getCertificateRecordById,
  createCertificateRecord,
  updateCertificateRecord,
  deleteCertificateRecord,
  saveCertificates,
  generateCertificatePdf,
} = require('../controllers/certificateController');
const { protect } = require('../middleware/auth');

// ── Generic Certificate Routes ──
router.get('/', protect, getCertificates);
router.post('/', protect, saveCertificates);
router.put('/', protect, saveCertificates);
router.post('/generate-pdf', generateCertificatePdf);

// ── Individual Dedicated Endpoints for 3 Certificate Types ──
// 1. Marriage Certificate Endpoints
router.get('/marriage', protect, (req, res) => {
  req.query = req.query || {};
  req.query.type = 'marriage';
  getCertificates(req, res);
});
router.post('/marriage', protect, (req, res) => {
  req.body = req.body || {};
  req.body.type = 'marriage';
  createCertificateRecord(req, res);
});

// 2. NOC Certificate Endpoints
router.get('/noc', protect, (req, res) => {
  req.query = req.query || {};
  req.query.type = 'noc';
  getCertificates(req, res);
});
router.post('/noc', protect, (req, res) => {
  req.body = req.body || {};
  req.body.type = 'noc';
  createCertificateRecord(req, res);
});

// 3. Letterhead Endpoints
router.get('/letterhead', protect, (req, res) => {
  req.query = req.query || {};
  req.query.type = 'letterhead';
  getCertificates(req, res);
});
router.post('/letterhead', protect, (req, res) => {
  req.body = req.body || {};
  req.body.type = 'letterhead';
  createCertificateRecord(req, res);
});

// ── Specific Record CRUD by ID ──
router.get('/records/:id', protect, getCertificateRecordById);
router.post('/records', protect, createCertificateRecord);
router.put('/records/:id', protect, updateCertificateRecord);
router.delete('/records/:id', protect, deleteCertificateRecord);

module.exports = router;

