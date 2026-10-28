const express = require('express');
const { protect, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { 
  getJobVacancies, 
  getJobVacancyById, 
  postJobVacancy, 
  deleteJobVacancy,
  exportJobVacancies,
  downloadExportedJobVacancies
} = require('../controllers/jobVacancyController');

const router = express.Router();

const optionalProtect = async (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (token) {
        return protect(req, res, next);
    }
    return next();
};

router.get('/', optionalProtect, getJobVacancies);
router.get('/export', protect, exportJobVacancies);
router.get('/export/download/:filename', downloadExportedJobVacancies);
router.get('/:id', optionalProtect, getJobVacancyById);
router.post('/', protect, parseForm, postJobVacancy);
router.put('/:id', protect, parseForm, postJobVacancy);
router.delete('/:id', protect, deleteJobVacancy);

module.exports = router;