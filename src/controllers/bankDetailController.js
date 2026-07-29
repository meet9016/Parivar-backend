const mongoose = require('mongoose');
const BankDetail = require('../models/bankDetailModel');
const { apiResponse } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const getBankDetails = async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(BankDetail, requestData(req), {
      searchFields: ['bank_name', 'account_number', 'ifsc_code', 'branch'],
      filterFields: ['status']
    });

    return res.status(200).json({
      status: 200,
      message: 'Bank Details retrieved successfully',
      data: data.map(d => ({
        id: d.id || String(d._id),
        bank_name: d.bank_name || '',
        account_name: d.account_name || '',
        account_number: d.account_number || '',
        ifsc_code: d.ifsc_code || '',
        branch: d.branch || '',
        upi_link: d.upi_link || '',
        qr_code: d.qr_code || '',
        status: Number(d.status ?? 1)
      })),
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Error retrieving bank details', data: [], error: error.message });
  }
};

const getBankDetailById = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }
    const bankDetail = await BankDetail.findOne({ $or: orConditions }).lean();
    if (!bankDetail) {
      return res.status(404).json({ status: 404, message: 'Bank Detail not found', data: [] });
    }
    return res.status(200).json({
      status: 200,
      message: 'Bank Detail retrieved successfully',
      data: {
        id: bankDetail.id || String(bankDetail._id),
        bank_name: bankDetail.bank_name || '',
        account_name: bankDetail.account_name || '',
        account_number: bankDetail.account_number || '',
        ifsc_code: bankDetail.ifsc_code || '',
        branch: bankDetail.branch || '',
        upi_link: bankDetail.upi_link || '',
        qr_code: bankDetail.qr_code || '',
        status: Number(bankDetail.status ?? 1)
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Error retrieving bank detail', data: [], error: error.message });
  }
};

const saveBankDetail = async (req, res) => {
  try {
    const { id } = req.params;
    let existing = null;
    if (id) {
      const orConditions = [{ id }];
      if (mongoose.isValidObjectId(id)) {
        orConditions.push({ _id: id });
      }
      existing = await BankDetail.findOne({ $or: orConditions });
    }

    if (id && !existing) {
      return res.status(404).json({ status: 404, message: 'Bank Detail not found', data: [] });
    }

    const { bank_name, account_name, account_number, ifsc_code, branch, upi_link, qr_code, status } = requestData(req);

    if (!existing && (!bank_name || !account_number || !ifsc_code)) {
      return res.status(400).json({ status: 400, message: 'Bank Name, Account Number and IFSC Code are mandatory', data: [] });
    }

    const bankDetail = existing || new BankDetail({
      id: `BANK${Date.now()}`,
      cdate: new Date().toISOString().slice(0, 10)
    });

    const updateFields = {};
    if (bank_name !== undefined) updateFields.bank_name = bank_name;
    if (account_name !== undefined) updateFields.account_name = account_name;
    if (account_number !== undefined) updateFields.account_number = account_number;
    if (ifsc_code !== undefined) updateFields.ifsc_code = ifsc_code;
    if (branch !== undefined) updateFields.branch = branch;
    if (upi_link !== undefined) updateFields.upi_link = upi_link;
    if (qr_code !== undefined) updateFields.qr_code = qr_code;
    if (status !== undefined) updateFields.status = Number(status);

    bankDetail.set(updateFields);
    await bankDetail.save();

    return res.status(existing ? 200 : 201).json({
      status: existing ? 200 : 201,
      message: `Bank Detail ${existing ? 'updated' : 'saved'} successfully`,
      data: {
        id: bankDetail.id || String(bankDetail._id),
        bank_name: bankDetail.bank_name || '',
        account_name: bankDetail.account_name || '',
        account_number: bankDetail.account_number || '',
        ifsc_code: bankDetail.ifsc_code || '',
        branch: bankDetail.branch || '',
        upi_link: bankDetail.upi_link || '',
        qr_code: bankDetail.qr_code || '',
        status: Number(bankDetail.status ?? 1)
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Error saving bank detail', data: [], error: error.message });
  }
};

const deleteBankDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }
    const result = await BankDetail.deleteOne({ $or: orConditions });
    if (result.deletedCount === 0) {
      return res.status(404).json({ status: 404, message: 'Bank Detail not found', data: [] });
    }
    return res.status(200).json({ status: 200, message: 'Bank Detail deleted successfully', data: [] });
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'Error deleting bank detail', data: [], error: error.message });
  }
};

module.exports = {
  getBankDetails,
  getBankDetailById,
  saveBankDetail,
  deleteBankDetail
};
