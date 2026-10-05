const express = require('express');
const router = express.Router();
const { parseForm } = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const mobileReg = require('../controllers/mobileRegistrationController');

// Optional protect middleware (allows user to pass token if logged in or pass user_id/number)
const optionalProtect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return protect(req, res, next);
  }
  return next();
};

/**
 * Multi-Step Mobile Registration Endpoints
 */

// Step 1: Personal Information (Profile photo, Father/Husband Name, Patti/Pargana, Gender, Blood Group, DOB, Marital Status)
router.post('/step-1', optionalProtect, parseForm, mobileReg.saveStep1);

// Step 2: Family Details (Array of family members: name, relation, mobile, age, gender)
router.post('/step-2', optionalProtect, parseForm, mobileReg.saveStep2);

// Step 3: Address Information (State, District, City, Address, Pincode)
router.post('/step-3', optionalProtect, parseForm, mobileReg.saveStep3);

// Step 4: Occupation & Business details
router.post('/step-4', optionalProtect, parseForm, mobileReg.saveStep4);

// Step 5: Document Uploads (Aadhaar, PAN, Voter ID, Driving License, Passport)
router.post('/step-5', optionalProtect, parseForm, mobileReg.saveStep5);

// Step 6: Review Summary (Fetch all filled data for confirmation)
router.get('/review/:user_id?', optionalProtect, mobileReg.getReviewSummary);

// Final Action: Confirm & Submit for Review
router.post('/submit', optionalProtect, parseForm, mobileReg.submitForReview);

// All-in-One Full Registration Endpoint
router.post('/complete', parseForm, mobileReg.completeFullRegistration);

// Admin Portal Management Endpoints
router.get('/admin/list', protect, mobileReg.getRegistrationsList);
router.get('/admin/:id', protect, mobileReg.getRegistrationDetails);
router.post('/admin/:id/approve', protect, mobileReg.approveRegistration);
router.post('/admin/:id/reject', protect, parseForm, mobileReg.rejectRegistration);
router.post('/admin/:id/request-correction', protect, parseForm, mobileReg.requestCorrectionRegistration);

module.exports = router;
