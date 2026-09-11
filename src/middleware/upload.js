const multer = require('multer');
const path = require('path');
const { uploadToExternalService } = require('../utils/fileUpload');
const { tenantContext } = require('../utils/tenantContext');

const runWithTenant = (req, fn) => {
  if (req && req.tenantConn) {
    return tenantContext.run({ tenantConn: req.tenantConn }, fn);
  }
  return fn();
};

// Storage engine config (Memory storage to allow uploading to external service)
const storage = multer.memoryStorage();

// Image and document type validation
const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = /\.(jpe?g|png|webp|gif|svg|avif|heic|heif|bmp|ico|tiff?|pdf|docx?|xlsx?|pptx?|mp4|webm|mov|avi|jfif)$/i;
  const mime = (file.mimetype || '').toLowerCase();
  const isAllowedMime = 
    mime.startsWith('image/') || 
    mime.startsWith('video/') || 
    mime.includes('pdf') || 
    mime.includes('document') || 
    mime.includes('sheet') || 
    mime === 'application/octet-stream';

  if (isAllowedMime || allowedExtensions.test(ext) || !ext) {
    cb(null, true);
  } else {
    // Gracefully accept rather than crash user form
    cb(null, true);
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 25 * 1024 * 1024, // 25 MB limit per file
    fieldSize: 25 * 1024 * 1024  // 25 MB limit for field values (allows base64 strings and large JSON)
  },
  fileFilter: fileFilter
});

const fileFields = [
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 20 },
  { name: 'gallery_image_1', maxCount: 1 },
  { name: 'gallery_image_2', maxCount: 1 },
  { name: 'gallery_image_3', maxCount: 1 },
  { name: 'gallery_image_4', maxCount: 1 },
  { name: 'gallery_image_5', maxCount: 1 },
];

// Multer fields mapping for business details (Logo + up to 5 gallery images)
const multerBusinessUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery_image', maxCount: 5 },
]);

const businessUpload = (req, res, next) => {
  multerBusinessUpload(req, res, async (err) => {
    if (err) return runWithTenant(req, () => next(err));
    try {
      if (req.files) {
        const uploadPromises = [];
        for (const fieldName in req.files) {
          const filesArray = req.files[fieldName];
          for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            uploadPromises.push(
              uploadToExternalService(file, fieldName).then(imagePath => {
                file.filename = imagePath;
              })
            );
          }
        }
        await Promise.all(uploadPromises);
      }
      return runWithTenant(req, () => next());
    } catch (error) {
      return runWithTenant(req, () => next(error));
    }
  });
};

// Multer single image upload for posts & events
const multerPostUpload = upload.single('image');

const postUpload = (req, res, next) => {
  multerPostUpload(req, res, async (err) => {
    if (err) return runWithTenant(req, () => next(err));
    try {
      if (req.file) {
        const imagePath = await uploadToExternalService(req.file, req.file.fieldname);
        req.body[req.file.fieldname] = imagePath;
        // Delete req.file so controllers fall back to req.body.image and don't prepend /uploads/
        delete req.file;
      }
      return runWithTenant(req, () => next());
    } catch (error) {
      return runWithTenant(req, () => next(error));
    }
  });
};

const parseForm = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return runWithTenant(req, () => next());
  }

  return upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 20 },

    { name: 'gallery_image_1', maxCount: 1 },
    { name: 'gallery_image_2', maxCount: 1 },
    { name: 'gallery_image_3', maxCount: 1 },
    { name: 'gallery_image_4', maxCount: 1 },
    { name: 'gallery_image_5', maxCount: 1 },
    { name: 'result_image', maxCount: 1 },
    { name: 'biodata', maxCount: 1 },
    { name: 'person_image', maxCount: 1 },
    { name: 'qr_code', maxCount: 1 },
    { name: 'student_image', maxCount: 1 },

    { name: 'bannerImages', maxCount: 20 },
    { name: 'appLogo', maxCount: 1 },
    { name: 'webLogo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },

  ])(req, res, async (error) => {
    if (error) return runWithTenant(req, () => next(error));

    try {
      if (Array.isArray(req.files)) {
        const uploadPromises = req.files.map(file => 
          uploadToExternalService(file, file.fieldname).then(imagePath => ({
            fieldName: file.fieldname,
            imagePath
          }))
        );
        
        const uploadedFiles = await Promise.all(uploadPromises);
        
        for (const { fieldName, imagePath } of uploadedFiles) {
          if (fieldName === 'images') {
            if (!Array.isArray(req.body.images)) {
              req.body.images = [];
            }
            req.body.images.push(imagePath);
            continue;
          }

          if (fieldName === 'bannerImages') {
            if (!Array.isArray(req.body.bannerImages)) {
              req.body.bannerImages = req.body.bannerImages ? [req.body.bannerImages] : [];
            }
            req.body.bannerImages.push(imagePath);
            continue;
          }

          if (req.body[fieldName] === undefined) {
            req.body[fieldName] = imagePath;
          } else if (Array.isArray(req.body[fieldName])) {
            req.body[fieldName].push(imagePath);
          } else {
            req.body[fieldName] = [req.body[fieldName], imagePath];
          }
        }
      } else if (req.files) {
        const uploadPromises = [];
        
        for (const fieldName in req.files) {
          const filesArray = req.files[fieldName];
          for (const file of filesArray) {
            uploadPromises.push(
              uploadToExternalService(file, fieldName).then(imagePath => ({
                fieldName,
                imagePath
              }))
            );
          }
        }
        
        const uploadedFiles = await Promise.all(uploadPromises);
        
        for (const { fieldName, imagePath } of uploadedFiles) {
          if (fieldName === 'images') {
            if (!Array.isArray(req.body.images)) {
              req.body.images = [];
            }
            req.body.images.push(imagePath);
            continue;
          }

          if (fieldName === 'bannerImages') {
            if (!Array.isArray(req.body.bannerImages)) {
              req.body.bannerImages = req.body.bannerImages ? [req.body.bannerImages] : [];
            }
            req.body.bannerImages.push(imagePath);
            continue;
          }

          if (req.body[fieldName] === undefined) {
            req.body[fieldName] = imagePath;
          } else if (Array.isArray(req.body[fieldName])) {
            req.body[fieldName].push(imagePath);
          } else {
            req.body[fieldName] = [req.body[fieldName], imagePath];
          }
        }
      } else if (req.file) {
        const imagePath = await uploadToExternalService(req.file, req.file.fieldname);
        req.body[req.file.fieldname] = imagePath;
      }

      // Normalize bannerImages to array of valid URLs
      if (req.body.bannerImages !== undefined) {
        const raw = Array.isArray(req.body.bannerImages) ? req.body.bannerImages : [req.body.bannerImages];
        req.body.bannerImages = raw.filter(url => typeof url === 'string' && url.trim().length > 0);
      }

      // Clear req.file and req.files so controllers don't prepend /uploads/
      if (req.file) delete req.file;
      if (req.files) delete req.files;

      return runWithTenant(req, () => next());
    } catch (err) {
      return runWithTenant(req, () => next(err));
    }
  });
};

module.exports = {
  upload,
  businessUpload,
  postUpload,
  parseForm
};

module.exports = {
  upload,
  businessUpload,
  postUpload,
  parseForm
};
