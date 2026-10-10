const multer = require('multer');
const path = require('path');
const { tenantContext } = require('../utils/tenantContext');

const runWithTenant = (req, fn) => {
  if (req && req.tenantConn) {
    return tenantContext.run({ tenantConn: req.tenantConn }, fn);
  }
  return fn();
};

// Multer memory storage engine to hold uploaded file in buffer for the shared storage service
const storage = multer.memoryStorage();

// Strict PDF validator
const pdfFileFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const isPdf = ext === '.pdf' || mime === 'application/pdf' || mime === 'application/x-pdf';

  if (isPdf) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type: Only PDF documents (.pdf) are permitted.'));
  }
};

const uploadCertificate = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024,  // 25 MB max file size
    fieldSize: 50 * 1024 * 1024, // 50 MB max for large embedded HTML
  },
  fileFilter: pdfFileFilter,
});

/**
 * Universal upload middleware for certificate routes:
 * Gracefully handles multipart/form-data (extracting 'pdf' or 'file' or 'certificate_pdf')
 * as well as standard application/json requests.
 */
const parseCertificateUpload = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return runWithTenant(req, () => next());
  }

  return uploadCertificate.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'certificate_pdf', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      return runWithTenant(req, () => next(err));
    }

    if (req.files) {
      const uploadedFile = req.files.pdf?.[0] || req.files.file?.[0] || req.files.certificate_pdf?.[0];
      if (uploadedFile) {
        req.file = uploadedFile;
      }
    }

    // Parse JSON string data if passed in a form field 'data'
    if (req.body && typeof req.body.data === 'string') {
      try {
        req.body.data = JSON.parse(req.body.data);
      } catch (_) {}
    }

    return runWithTenant(req, () => next());
  });
};

module.exports = {
  uploadCertificate,
  parseCertificateUpload,
};
