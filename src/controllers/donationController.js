const mongoose = require('mongoose');
const Donation = require('../models/donationModel');
const queryHelper = require('../utils/queryHelper');
const { generateExcelExport, sendExportedExcelFile } = require('../utils/excelHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const getDonations = async (req, res) => {
  try {
    const { data: donations, pagination } = await queryHelper(Donation, requestData(req), {
      searchFields: ['donator_name', 'donation_purpose'],
      filterFields: ['donator_name', 'donation_purpose', 'status',]
    });

    return res.status(200).json({
      status: 200,
      message: 'Donations retrieved successfully',
      data: donations.map(d => ({
        id: d._id || String(d._id),
        donator_name: d.donator_name || '',
        donate_amount: Number(d.donate_amount || 0),
        donation_purpose: d.donation_purpose || '',
        date: d.date || '',
        status: Number(d.status ?? 1)
      })),
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
      status
    } = requestData(req);

    if (donator_name) donation.donator_name = donator_name;
    if (donate_amount !== undefined) donation.donate_amount = Number(donate_amount);
    if (donation_purpose !== undefined) donation.donation_purpose = donation_purpose;
    if (date !== undefined) donation.date = date;
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

const adminGetDonations = async (req, res) => {
  try {
    const { data: donations, pagination } = await queryHelper(Donation, req.query, {
      searchFields: ['donator_name', 'donation_purpose'],
      filterFields: ['donator_name', 'donation_purpose', 'status',]
    });

    return res.status(200).json({
      status: 200,
      message: 'Donations retrieved successfully',
      data: donations.map(d => ({
        id: d._id || String(d._id),
        donator_name: d.donator_name || '',
        donate_amount: Number(d.donate_amount || 0),
        donation_purpose: d.donation_purpose || '',
        date: d.date || '',
        status: Number(d.status ?? 1)
      })),
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
    const { search } = req.query;
    const query = {};

    if (search && String(search).trim()) {
      const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapeRegExp(String(search).trim()), 'i');
      query.$or = [{ donator_name: regex }, { donation_purpose: regex }];
    }

    const donations = await Donation.find(query).sort({ date: -1, createdAt: -1 }).lean();

    const formatDate = (val) => {
      if (!val) return '-';
      try {
        const str = String(val).trim();
        if (!str) return '-';
        if (str.includes('/')) {
          const parts = str.split('/');
          if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            return `${d}/${m}/${y}`;
          }
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return String(val || '-');
      }
    };

    const columns = [
      { header: 'DONATOR NAME', key: 'donator_name', width: 28, align: 'left', bold: true },
      { header: 'AMOUNT (₹)', key: 'donate_amount', width: 18, align: 'right' },
      { header: 'PURPOSE', key: 'donation_purpose', width: 32, align: 'left' },
      { header: 'DATE', key: 'date', width: 16, align: 'center' },
      { header: 'PAYMENT MODE', key: 'payment_mode', width: 18, align: 'center' },
      { header: 'STATUS', key: 'status', width: 14, align: 'center' }
    ];

    const rows = donations.map(d => ({
      donator_name: d.donator_name || '-',
      donate_amount: Number(d.donate_amount || 0),
      donation_purpose: d.donation_purpose || '-',
      date: formatDate(d.date),
      payment_mode: d.payment_mode || 'Cash',
      status: Number(d.status ?? 1) === 1 ? 'Active' : 'Inactive'
    }));

    const { download_url, filename } = await generateExcelExport({
      req,
      filePrefix: 'Donations',
      sheetName: 'Donations',
      columns,
      rows
    });

    return res.status(200).json({
      status: 200,
      message: 'Donations exported successfully',
      data: {
        download_url,
        filename
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Export failed', error: error.message });
  }
};

const downloadExportedDonations = (req, res) => {
  return sendExportedExcelFile(req, res);
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
  downloadExportedDonations
};
