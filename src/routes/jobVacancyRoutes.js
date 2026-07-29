const express = require('express');
const { protect } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getJobVacancies, getJobVacancyById, postJobVacancy, deleteJobVacancy } = require('../controllers/jobVacancyController');

const router = express.Router();

router.get('/', protect, getJobVacancies);
router.get('/:id', protect, getJobVacancyById);
router.post('/', protect, parseForm, postJobVacancy);
router.put('/:id', protect, parseForm, postJobVacancy);
router.delete('/:id', protect, deleteJobVacancy);

module.exports = router;