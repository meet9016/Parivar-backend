const express = require('express');
const router = express.Router();
const {
  getPricingPlans,
  getAllPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  deletePricingPlan,
} = require('../controllers/pricingController');

// GET /api/pricing — Public: Get all active pricing plans (sorted)
router.get('/', getPricingPlans);

// GET /api/pricing/all — Superadmin: Get all pricing plans
router.get('/all', getAllPricingPlans);

// POST /api/pricing — Superadmin: Create a new pricing plan
router.post('/', createPricingPlan);

// PUT /api/pricing/:id — Superadmin: Update a pricing plan
router.put('/:id', updatePricingPlan);

// DELETE /api/pricing/:id — Superadmin: Delete a pricing plan
router.delete('/:id', deletePricingPlan);

module.exports = router;
