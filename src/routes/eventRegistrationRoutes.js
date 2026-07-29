const router = require('express').Router();
const {
  getRegistrationsList,
  getRegistrationById,
  addRegistration,
  updateRegistration,
  cancelRegistration,
  downloadRegistrations   
} = require('../controllers/eventRegistrationController');
const { protect } = require('../middleware/auth');



router.get('/', protect, getRegistrationsList);
router.get('/download', protect, downloadRegistrations);  
router.get('/:id', protect, getRegistrationById);
router.post('/',  addRegistration);
router.put('/:id', protect, updateRegistration);
router.patch('/:id/cancel', protect, cancelRegistration);


module.exports = router;