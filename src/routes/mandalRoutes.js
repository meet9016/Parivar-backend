const express = require('express');
const router = express.Router();
const { protect, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const mandalController = require('../controllers/mandalController');

const optionalProtect = async (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (token) {
    return protect(req, res, next);
  }
  return next();
};

// Multiple Mandals Management
router.get('/list', protect, mandalController.getMandalsList);
router.post('/create', protect, parseForm, mandalController.createMandal);
router.delete('/:id', protect, mandalController.deleteMandal);

// Single Mandal Setup / Update
router.get('/setup', protect, mandalController.getMandalSetup);
router.put('/setup', protect, parseForm, mandalController.updateMandalSetup);

// Mandal Members Management
router.get('/members', protect, mandalController.getMandalMembers);
router.post('/members/toggle', protect, parseForm, mandalController.toggleMandalMember);
router.post('/members/bulk', protect, parseForm, mandalController.bulkUpdateMandalMembers);

// Monthly Contributions
router.get('/my-contributions', protect, mandalController.getMyContributions);
router.get('/contributions/my', protect, mandalController.getMyContributions);
router.get('/contributions/export', protect, mandalController.exportMonthlyContributions);
router.get('/contributions', protect, mandalController.getMonthlyContributions);
router.put('/contributions/:id', protect, parseForm, mandalController.recordContribution);
router.post('/contributions/bulk-mark-paid', protect, parseForm, mandalController.bulkMarkPaid);
router.post('/contributions/send-reminders', protect, parseForm, mandalController.sendPendingReminders);

// Receipt Download Routes (Matches donation receipt pattern)
router.get('/contributions/receipt/:id/download', optionalProtect, mandalController.downloadContributionReceipt);
router.get('/contributions/:id/receipt/download', optionalProtect, mandalController.downloadContributionReceipt);
router.get('/contributions/receipt-link/:id', optionalProtect, mandalController.getContributionReceiptLink);
router.get('/contributions/:id/receipt-link', optionalProtect, mandalController.getContributionReceiptLink);
router.get('/contributions/receipts/bulk-download', optionalProtect, mandalController.bulkDownloadContributionReceipts);
router.post('/contributions/receipts/bulk-download', optionalProtect, mandalController.bulkDownloadContributionReceipts);
router.get('/contributions/receipts/bulk-link', optionalProtect, mandalController.getBulkContributionReceiptsLink);
router.post('/contributions/receipts/bulk-link', optionalProtect, mandalController.getBulkContributionReceiptsLink);

// Payment History (compatibility)
router.get('/history', protect, mandalController.getPaymentHistory);

// Dashboard
router.get('/dashboard', protect, mandalController.getMandalDashboard);

module.exports = router;
