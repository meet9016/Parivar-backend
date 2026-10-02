const express = require('express');
const router = express.Router();
const {
  getCertificates,
  createCertificateRecord,
  updateCertificateRecord,
  deleteCertificateRecord,
  saveCertificates,
  generateCertificatePdf,
} = require('../controllers/certificateController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getCertificates);
router.post('/', protect, saveCertificates);
router.put('/', protect, saveCertificates);
router.post('/generate-pdf', protect, generateCertificatePdf);

// Individual Certificate Record CRUD
router.post('/records', protect, createCertificateRecord);
router.put('/records/:id', protect, updateCertificateRecord);
router.delete('/records/:id', protect, deleteCertificateRecord);

module.exports = router;

