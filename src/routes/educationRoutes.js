const express = require('express');
const {
  getEducations,
  getEducationById,
  saveEducation,
  deleteEducation,
  getLevels
} = require('../controllers/educationController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

router.get('/levels', getLevels);
router.get('/', getEducations);
router.get('/:id', getEducationById);
router.post('/', protect, requirePermission('masters.add'), parseForm, saveEducation);
router.put('/:id', protect, requirePermission('masters.edit'), parseForm, saveEducation);
router.delete('/:id', protect, requirePermission('masters.delete'), deleteEducation);

module.exports = router;
