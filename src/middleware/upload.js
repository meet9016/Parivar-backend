const multer = require('multer');
const path = require('path');
const { uploadToExternalService } = require('../utils/fileUpload');

// Storage engine config (Memory storage to allow uploading to external service)
const storage = multer.memoryStorage();

// Image type validation
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif|pdf/i;
  const isExtensionAllowed = allowedExtensions.test(path.extname(file.originalname)) || !path.extname(file.originalname);
  const isMimetypeAllowed = allowedExtensions.test(file.mimetype) || file.mimetype.includes('pdf');

  if (isMimetypeAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Error: Only images and PDFs are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit per file
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
    if (err) return next(err);
    try {
      if (req.files) {
        for (const fieldName in req.files) {
          const filesArray = req.files[fieldName];
          for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            const imagePath = await uploadToExternalService(file, fieldName);
            file.filename = imagePath;
          }
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });
};

// Multer single image upload for posts
const multerPostUpload = upload.single('image');

const postUpload = (req, res, next) => {
  multerPostUpload(req, res, async (err) => {
    if (err) return next(err);
    try {
      if (req.file) {
        const imagePath = await uploadToExternalService(req.file, req.file.fieldname);
        req.body[req.file.fieldname] = imagePath;
        // Delete req.file so controllers fall back to req.body.image and don't prepend /uploads/
        delete req.file;
      }
      next();
    } catch (error) {
      next(error);
    }
  });
};

const parseForm = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return next();
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

    { name: 'bannerImages', maxCount: 5 },
    { name: 'appLogo', maxCount: 1 },
    { name: 'webLogo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },

  ])(req, res, async (error) => {
    if (error) return next(error);

    try {
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          const fieldName = file.fieldname;
          const imagePath = await uploadToExternalService(file, fieldName);

          if (fieldName === 'images') {
            if (!Array.isArray(req.body.images)) {
              req.body.images = [];
            }
            req.body.images.push(imagePath);
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
        for (const fieldName in req.files) {
          const filesArray = req.files[fieldName];
          for (const file of filesArray) {
            const imagePath = await uploadToExternalService(file, fieldName);

            if (fieldName === 'images') {
              if (!Array.isArray(req.body.images)) {
                req.body.images = [];
              }
              req.body.images.push(imagePath);
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
        }
      } else if (req.file) {
        const imagePath = await uploadToExternalService(req.file, req.file.fieldname);
        req.body[req.file.fieldname] = imagePath;
      }

      // Clear req.file and req.files so controllers don't prepend /uploads/
      if (req.file) delete req.file;
      if (req.files) delete req.files;

      return next();
    } catch (err) {
      return next(err);
    }
  });
};

module.exports = {
  upload,
  businessUpload,
  postUpload,
  parseForm
};
