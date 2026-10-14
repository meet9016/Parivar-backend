const mongoose = require('mongoose');
const Donation = require('../models/donationModel');
const { apiResponse } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const { generatePdfFromHtml } = require('../services/pdfService');
const { renderDonationReceiptHtml } = require('../templates/donationReceiptTemplateService');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

// --- MEMBER / MOBILE CONTROLLER METHODS ---

function resolveBaseUrl(req) {
  let base = '';
  if (process.env.BASE_URL) base = process.env.BASE_URL;
  else if (process.env.APP_URL) base = process.env.APP_URL;
  else if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5001';
    base = `${protocol}://${host}`;
  } else {
    base = 'http://localhost:5001';
  }
  return base.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

function buildDonationDownloadUrl(recId, req) {
  const baseUrl = resolveBaseUrl(req);
  const token = req?.query?.token || '';
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

  // In production (e.g. *.parivar.me) or when path contains /api/api, use /api/api prefix
  const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host') || '';
  const referer = req?.headers?.['referer'] || '';
  const isApiApi = (req?.originalUrl && req.originalUrl.includes('/api/api')) ||
                    host.includes('parivar.me') ||
                    referer.includes('parivar.me');

  const prefix = isApiApi ? '/api/api' : '/api';
  return `${baseUrl}${prefix}/donations/receipt/${recId}/download${tokenQuery}`;
}

function formatDonationRecord(d, req) {
  const id = String(d._id || d.id);
  const downloadUrl = buildDonationDownloadUrl(id, req);

  return {
    id,
    donator_name: d.donator_name || '',
    donate_amount: Number(d.donate_amount || 0),
    donation_purpose: d.donation_purpose || '',
    date: d.date || '',
    payment_mode: d.payment_mode || 'Cash',
    receipt_number: d.receipt_number || `DON-${id.slice(-6).toUpperCase()}`,
    download_url: downloadUrl,
    status: Number(d.status ?? 1)
  };
}

const getDonations = async (req, res) => {
  try {
    const { data: donations, pagination } = await queryHelper(Donation, requestData(req), {
      searchFields: ['donator_name', 'donation_purpose'],
      filterFields: ['donator_name', 'donation_purpose', 'status',]
    });

    return res.status(200).json({
      status: 200,
      message: 'Donations retrieved successfully',
      data: donations.map(d => formatDonationRecord(d, req)),
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error retrieving donations',
      data: [],
      error: error.message
    });
  }
};

const addDonation = async (req, res) => {
  try {
    const {
      donator_name,
      donate_amount,
      donation_purpose,
      date,
      payment_mode,
      status
    } = requestData(req);

    if (!donator_name || !donate_amount || !donation_purpose || !date) {
      return res.status(400).json({
        status: 400,
        message: 'All fields are mandatory',
        data: []
      });
    }

    const donationData = {
      id: `DON${Date.now()}`,
      donator_name,
      donate_amount: Number(donate_amount),
      donation_purpose,
      date,
      payment_mode: payment_mode || 'Cash',
      status: status === undefined ? 1 : Number(status),
      cdate: new Date().toISOString().slice(0, 10)
    };

    const donation = await Donation.create(donationData);
    return res.status(201).json({
      status: 201,
      message: 'Donation added successfully',
      data: {
        id: donation.id || String(donation._id),
        donator_name: donation.donator_name || '',
        donate_amount: Number(donation.donate_amount || 0),
        donation_purpose: donation.donation_purpose || '',
        date: donation.date || '',
        payment_mode: donation.payment_mode || 'Cash',
        status: Number(donation.status ?? 1)
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error adding donation',
      data: [],
      error: error.message
    });
  }
};

const updateDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const donation = await Donation.findOne({
      $or: orConditions
    });

    if (!donation) {
      return res.status(404).json({
        status: 404,
        message: 'Donation not found',
        data: []
      });
    }

    const {
      donator_name,
      donate_amount,
      donation_purpose,
      date,
      payment_mode,
      status
    } = requestData(req);

    if (donator_name) donation.donator_name = donator_name;
    if (donate_amount !== undefined) donation.donate_amount = Number(donate_amount);
    if (donation_purpose !== undefined) donation.donation_purpose = donation_purpose;
    if (date !== undefined) donation.date = date;
    if (payment_mode !== undefined) donation.payment_mode = payment_mode;
    if (status !== undefined) donation.status = Number(status);

    await donation.save();
    return res.status(200).json({
      status: 200,
      message: 'Donation updated successfully',
      data: {
        id: donation.id || String(donation._id),
        donator_name: donation.donator_name || '',
        donate_amount: Number(donation.donate_amount || 0),
        donation_purpose: donation.donation_purpose || '',
        date: donation.date || '',
        payment_mode: donation.payment_mode || 'Cash',
        status: Number(donation.status ?? 1)
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error updating donation',
      data: [],
      error: error.message
    });
  }
};

const deleteDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const result = await Donation.deleteOne({
      $or: orConditions
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 404,
        message: 'Donation not found',
        data: []
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Donation deleted successfully',
      data: []
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error deleting donation',
      data: [],
      error: error.message
    });
  }
};

// --- ADMIN / SOFTWARE CONTROLLER METHODS ---

const adminGetDonations = async (req, res) => {
  try {
    const { data: donations, pagination } = await queryHelper(Donation, req.query, {
      searchFields: ['donator_name', 'donation_purpose'],
      filterFields: ['donator_name', 'donation_purpose', 'status',]
    });

    return res.status(200).json({
      status: 200,
      message: 'Donations retrieved successfully',
      data: donations.map(d => formatDonationRecord(d, req)),
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error retrieving donations',
      data: [],
      error: error.message
    });
  }
};

const adminSaveDonation = async (req, res) => {
  try {
    const { id } = req.params;
    let existing = null;
    if (id) {
      const orConditions = [{ id }];
      if (mongoose.isValidObjectId(id)) {
        orConditions.push({ _id: id });
      }
      existing = await Donation.findOne({
        $or: orConditions
      });
    }

    if (id && !existing) {
      return res.status(404).json({
        status: 404,
        message: 'Donation not found',
        data: []
      });
    }

    const {
      donator_name,
      donate_amount,
      donation_purpose,
      date,
      payment_mode,
      status
    } = requestData(req);

    // For new donation, check mandatory fields
    if (!existing && (!donator_name || !donate_amount || !donation_purpose || !date)) {
      return res.status(400).json({
        status: 400,
        message: 'All fields are mandatory',
        data: []
      });
    }

    const donation = existing || new Donation({
      cdate: new Date().toISOString().slice(0, 10)
    });

    const updateFields = {};
    if (donator_name !== undefined) updateFields.donator_name = donator_name;
    if (donate_amount !== undefined) updateFields.donate_amount = Number(donate_amount);
    if (donation_purpose !== undefined) updateFields.donation_purpose = donation_purpose;
    if (date !== undefined) updateFields.date = date;
    if (payment_mode !== undefined) updateFields.payment_mode = payment_mode;
    if (status !== undefined) updateFields.status = Number(status);

    donation.set(updateFields);
    await donation.save();

    return res.status(existing ? 200 : 201).json({
      status: existing ? 200 : 201,
      message: `Donation ${existing ? 'updated' : 'saved'} successfully`,
      data: {
        id: donation.id || String(donation._id),
        donator_name: donation.donator_name || '',
        donate_amount: Number(donation.donate_amount || 0),
        donation_purpose: donation.donation_purpose || '',
        date: donation.date || '',
        payment_mode: donation.payment_mode || 'Cash',
        status: Number(donation.status ?? 1)
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error saving donation',
      data: [],
      error: error.message
    });
  }
};

const adminDeleteDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const result = await Donation.deleteOne({
      $or: orConditions
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 404,
        message: 'Donation not found',
        data: []
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Donation deleted successfully',
      data: []
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error deleting donation',
      data: [],
      error: error.message
    });
  }
};

const exportDonations = async (req, res) => {
  try {
    const { search } = req.query
    const query = {}
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$or = [{ donator_name: regex }, { donation_purpose: regex }]
    }
    const donations = await Donation.find(query).sort({ _id: -1 }).lean()
    const rows = donations.map(d => ({
      'Donator Name': d.donator_name || '',
      'Amount (₹)': Number(d.donate_amount || 0),
      'Purpose': d.donation_purpose || '',
      'Date': d.date || '',
      'Status': Number(d.status ?? 1) === 1 ? 'Active' : 'Inactive'
    }))
    const header = Object.keys(rows[0] || { 'Donator Name': '', 'Amount (₹)': '', 'Purpose': '', 'Date': '', 'Status': '' })
    const csv = [
      header.join(','),
      ...rows.map(row => header.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"')
    return res.status(200).send(csv)
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Export failed', error: error.message })
  }
}



const downloadDonationReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const donation = await Donation.findOne({
      $or: orConditions
    });

    if (!donation) {
      return res.status(404).json({
        status: 404,
        message: 'Donation record not found',
        data: null
      });
    }

    // Resolve tenant / community config if available
    let config = null;
    try {
      const Config = require('../models/configModel');
      config = await Config.findOne().lean();
    } catch (_) { }

    const html = await renderDonationReceiptHtml(donation, config || {});

    const cleanDonor = (donation.donator_name || 'Donor').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const recId = String(donation.id || donation._id).slice(-6).toUpperCase();
    const filename = `Donation_Receipt_${cleanDonor}_${recId}`;

    const pdfBuffer = await generatePdfFromHtml(html, {
      filename,
    });


    const isInline = req.query.view === 'true' || req.query.inline === 'true' || req.path.includes('/view');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${filename}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}.pdf`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Error generating donation receipt PDF:', error);
    return res.status(500).json({
      status: 500,
      message: 'Failed to generate donation receipt PDF',
      error: error.message
    });
  }
};

const getDonationReceiptLink = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const donation = await Donation.findOne({
      $or: orConditions
    });

    if (!donation) {
      return res.status(404).json({
        status: 404,
        message: 'Donation record not found',
        data: null
      });
    }

    const recId = String(donation.id || donation._id);
    const downloadUrl = buildDonationDownloadUrl(recId, req);

    return res.status(200).json({
      status: 200,
      message: 'Receipt download link generated successfully',
      data: {
        id: recId,
        donator_name: donation.donator_name || '',
        receipt_number: donation.receipt_number || `DON-${recId.slice(-6).toUpperCase()}`,
        download_url: downloadUrl
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Failed to retrieve receipt link',
      error: error.message
    });
  }
};

module.exports = {
  getDonations,
  addDonation,
  updateDonation,
  deleteDonation,
  adminGetDonations,
  adminSaveDonation,
  adminDeleteDonation,
  exportDonations,
  downloadDonationReceipt,
  getDonationReceiptLink,
};
