const express = require('express');
const {
  getBankDetails,
  getBankDetailById,
  saveBankDetail,
  deleteBankDetail
} = require('../controllers/bankDetailController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

router.get('/', getBankDetails);
router.get('/:id', getBankDetailById);
router.post('/', protect, requirePermission('bank-details.edit'), parseForm, saveBankDetail);
router.put('/:id', protect, requirePermission('bank-details.edit'), parseForm, saveBankDetail);
router.delete('/:id', protect, requirePermission('bank-details.delete'), deleteBankDetail);

module.exports = router;
