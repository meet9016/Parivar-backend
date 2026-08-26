const Inquiry = require('../models/inquiryModel');
const { apiResponse } = require('../utils/apiResponse');

// POST /api/inquiry — Create new inquiry
const createInquiry = async (req, res) => {
  try {
    const { parivar_name, email, mobile, note } = req.body;

    if (!parivar_name || !mobile) {
      return apiResponse(res, 400, 'Parivar name and mobile number are required');
    }

    const inquiry = new Inquiry({
      parivar_name: parivar_name.trim(),
      email: email ? email.trim().toLowerCase() : '',
      mobile: mobile.trim(),
      note: note ? note.trim() : '',
    });

    await inquiry.save();

    return apiResponse(res, 201, 'Inquiry submitted successfully', {
      _id: inquiry._id,
      parivar_name: inquiry.parivar_name,
      email: inquiry.email,
      mobile: inquiry.mobile,
      note: inquiry.note,
      status: inquiry.status,
      createdAt: inquiry.createdAt,
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error submitting inquiry', { error: error.message });
  }
};

// GET /api/inquiry — Get all inquiries (admin protected)
const getInquiries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const query = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { parivar_name: regex },
        { email: regex },
        { mobile: regex },
        { note: regex },
      ];
    }

    if (status !== undefined && status !== '') {
      query.status = Number(status);
    }

    const [inquiries, total] = await Promise.all([
      Inquiry.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Inquiry.countDocuments(query),
    ]);

    return apiResponse(
      res,
      200,
      'Inquiries fetched successfully',
      inquiries,
      {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      }
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error fetching inquiries', { error: error.message });
  }
};

// PUT /api/inquiry/:id — Update inquiry status (admin)
const updateInquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const inquiry = await Inquiry.findByIdAndUpdate(
      id,
      { status: Number(status) },
      { new: true }
    );

    if (!inquiry) return apiResponse(res, 404, 'Inquiry not found');

    return apiResponse(res, 200, 'Inquiry status updated', inquiry);
  } catch (error) {
    return apiResponse(res, 500, 'Error updating inquiry', { error: error.message });
  }
};

module.exports = { createInquiry, getInquiries, updateInquiryStatus };
