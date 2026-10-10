const express = require('express');
const router = express.Router();
const {
  getCertificates,
  getCertificateRecordById,
  createCertificateRecord,
  updateCertificateRecord,
  deleteCertificateRecord,
  restoreCertificateRecord,
  viewCertificatePdf,
  downloadCertificatePdf,
  regenerateCertificatePdf,
  bulkDownloadCertificates,
  saveCertificates,
  generateCertificatePdf,
} = require('../controllers/certificateController');
const { parseCertificateUpload } = require('../middleware/certificateUpload');
const { protect } = require('../middleware/auth');

// ── Generic Certificate Routes ──
router.get('/', protect, getCertificates);
router.post('/', protect, parseCertificateUpload, saveCertificates);
router.put('/', protect, parseCertificateUpload, saveCertificates);
router.post('/generate-pdf', generateCertificatePdf);

// ── Authenticated Document Stream & Bulk Operations ──
router.get('/view/:id', protect, viewCertificatePdf);
router.get('/download/:id', protect, downloadCertificatePdf);
router.post('/bulk-download', protect, bulkDownloadCertificates);

// ── Individual Dedicated Endpoints for 3 Certificate Types ──
// 1. Marriage Certificate Endpoints
router.get('/marriage', protect, (req, res) => {
  req.query = req.query || {};
  req.query.type = 'marriage';
  getCertificates(req, res);
});
router.post('/marriage', protect, parseCertificateUpload, (req, res) => {
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
router.post('/noc', protect, parseCertificateUpload, (req, res) => {
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
router.post('/letterhead', protect, parseCertificateUpload, (req, res) => {
  req.body = req.body || {};
  req.body.type = 'letterhead';
  createCertificateRecord(req, res);
});

// ── Specific Record CRUD and Recovery by ID ──
router.get('/records/:id', protect, getCertificateRecordById);
router.post('/records', protect, parseCertificateUpload, createCertificateRecord);
router.put('/records/:id', protect, parseCertificateUpload, updateCertificateRecord);
router.delete('/records/:id', protect, deleteCertificateRecord);
router.post('/records/:id/restore', protect, restoreCertificateRecord);
router.post('/records/:id/regenerate-pdf', protect, regenerateCertificatePdf);

module.exports = router;

