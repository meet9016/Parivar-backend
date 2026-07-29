const express = require('express');
const { protect } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const {
  getMembers,
  getFamilyMembers,
  getCountryList,
  getStateList,
  getCityList
} = require('../controllers/directoryController');

const router = express.Router();

router.post('/members', protect, parseForm, getMembers);
router.get('/members', getMembers);
router.get('/members/:member_id', protect, (req, res, next) => {
  req.query.member_id = req.params.member_id;
  return getMembers(req, res, next);
});
router.post('/family_members', protect, parseForm, getFamilyMembers);
router.get('/family_members',getFamilyMembers);

router.get('/country_list',  getCountryList);
router.get('/state_list',  getStateList);
router.get('/city_list',  getCityList);

module.exports = router;
