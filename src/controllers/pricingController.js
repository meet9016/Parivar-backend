const { getRegistryConnection } = require('../config/registryDb');
const pricingSchema = require('../models/pricingSchema');
const { apiResponse } = require('../utils/apiResponse');

// Get Mongoose Model dynamically from registry connection
const getPricingModel = async () => {
  const registryConn = await getRegistryConnection();
  return registryConn.models.PricingPlan || registryConn.model('PricingPlan', pricingSchema);
};

// GET /api/pricing — Get all active pricing plans (ordered by order)
const getPricingPlans = async (req, res) => {
  try {
    const Pricing = await getPricingModel();
    const plans = await Pricing.find({ status: 1 }).sort({ order: 1 });
    return apiResponse(res, 200, 'Pricing plans fetched successfully', plans);
  } catch (error) {
    return apiResponse(res, 500, 'Error fetching pricing plans', { error: error.message });
  }
};

// GET /api/pricing/all — Superadmin only: Get all plans including inactive
const getAllPricingPlans = async (req, res) => {
  try {
    const Pricing = await getPricingModel();
    const plans = await Pricing.find().sort({ order: 1 });
    return apiResponse(res, 200, 'All pricing plans fetched successfully', plans);
  } catch (error) {
    return apiResponse(res, 500, 'Error fetching all pricing plans', { error: error.message });
  }
};

// POST /api/pricing — Superadmin: Create new pricing plan
const createPricingPlan = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      originalPrice,
      discountedPrice,
      description,
      features,
      badgeText,
      buttonText,
      whatsappMessage,
      status,
      order,
    } = req.body;

    if (!title || originalPrice === undefined || discountedPrice === undefined) {
      return apiResponse(res, 400, 'Title, Original Price, and Discounted Price are required');
    }

    const Pricing = await getPricingModel();
    const plan = new Pricing({
      title: title.trim(),
      subtitle: subtitle ? subtitle.trim() : '',
      originalPrice: Number(originalPrice),
      discountedPrice: Number(discountedPrice),
      description: description ? description.trim() : '',
      features: Array.isArray(features) ? features : [],
      badgeText: badgeText ? badgeText.trim() : '',
      buttonText: buttonText ? buttonText.trim() : 'Get Free Demo',
      whatsappMessage: whatsappMessage ? whatsappMessage.trim() : '',
      status: status !== undefined ? Number(status) : 1,
      order: order !== undefined ? Number(order) : 0,
    });

    await plan.save();
    return apiResponse(res, 201, 'Pricing plan created successfully', plan);
  } catch (error) {
    return apiResponse(res, 500, 'Error creating pricing plan', { error: error.message });
  }
};

// PUT /api/pricing/:id — Superadmin: Update pricing plan
const updatePricingPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const Pricing = await getPricingModel();
    const plan = await Pricing.findById(id);

    if (!plan) {
      return apiResponse(res, 404, 'Pricing plan not found');
    }

    const fields = [
      'title',
      'subtitle',
      'originalPrice',
      'discountedPrice',
      'description',
      'features',
      'badgeText',
      'buttonText',
      'whatsappMessage',
      'status',
      'order',
    ];

    fields.forEach((field) => {
      if (updates[field] !== undefined) {
        if (field === 'originalPrice' || field === 'discountedPrice' || field === 'status' || field === 'order') {
          plan[field] = Number(updates[field]);
        } else if (field === 'features') {
          plan[field] = Array.isArray(updates[field]) ? updates[field] : [];
        } else {
          plan[field] = String(updates[field]).trim();
        }
      }
    });

    await plan.save();
    return apiResponse(res, 200, 'Pricing plan updated successfully', plan);
  } catch (error) {
    return apiResponse(res, 500, 'Error updating pricing plan', { error: error.message });
  }
};

// DELETE /api/pricing/:id — Superadmin: Delete pricing plan
const deletePricingPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const Pricing = await getPricingModel();
    const plan = await Pricing.findByIdAndDelete(id);

    if (!plan) {
      return apiResponse(res, 404, 'Pricing plan not found');
    }

    return apiResponse(res, 200, 'Pricing plan deleted successfully', plan);
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting pricing plan', { error: error.message });
  }
};

module.exports = {
  getPricingPlans,
  getAllPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  deletePricingPlan,
};
