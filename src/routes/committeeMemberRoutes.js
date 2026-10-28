const express = require('express');

const router = express.Router();

const { protect } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { 
  getcommitteeMembers, 
  createcommitteeMember, 
  updatecommitteeMember, 
  deletecommitteeMember,
  exportCommitteeMembers,
  downloadExportedCommitteeMembers,
  exportCommitteeMembersPdf,
  downloadExportedCommitteeMembersPdf
} = require('../controllers/committeeMemberController');

router.get('/', getcommitteeMembers);
router.get('/export', protect, exportCommitteeMembers);
router.get('/export/download/:filename', downloadExportedCommitteeMembers);
router.get('/export-pdf', protect, exportCommitteeMembersPdf);
router.get('/export-pdf/download/:filename', downloadExportedCommitteeMembersPdf);
router.post('/', protect, parseForm, createcommitteeMember);
router.put('/:id', protect, parseForm, updatecommitteeMember);
router.delete('/:id', protect, deletecommitteeMember);

module.exports = router;



