const mongoose = require('mongoose');
const { apiResponse, publicUrl } = require("../utils/apiResponse");
const CommitteeMember = require('../models/committeeMemberModel');
const queryHelper = require("../utils/queryHelper");
const bcrypt = require('bcryptjs');
const { generateExcelExport, sendExportedExcelFile } = require('../utils/excelHelper');
const { generatePdfExport, sendExportedPdfFile } = require('../utils/pdfHelper');
const Config = require('../models/configModel');

const getcommitteeMembers = async (req, res) => {
  try {
    let baseQuery = {};
    if (req.query.role) {
      const Role = require('../models/roleModel');
      const roleDoc = await Role.findOne({ name: req.query.role }).lean();
      if (roleDoc) {
        baseQuery.role_id = roleDoc._id;
      }
    }

    const { data: committee, pagination } = await queryHelper(CommitteeMember, req.query, {
      baseQuery,
      searchFields: ['first_name', 'middle_name', 'last_name', 'number', 'email', 'designation'],
      filterFields: ['status', 'role_id'],
      defaultSort: { createdAt: -1 },
      populate: ['role_id']
    });

    const data = committee.map((member) => ({
      id: String(member._id),
      first_name: member.first_name || '',
      middle_name: member.middle_name || '',
      last_name: member.last_name || '',
      number: member.number || '',
      email: member.email || '',
      role_id: member.role_id?._id ? String(member.role_id._id) : (member.role_id || ''),
      role_name: member.role_id?.name || '',
      designation: member.designation || '',
      status: Number(member.status ?? 1),
      image: publicUrl(req, member.signature || member.image || '')
    }));

    return apiResponse(res, 200, 'committee Memeber Data fetch successful', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving committee', { error: error.message });
  }
};

const createcommitteeMember = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, number, email, password, role_id, designation, status } = req.body;

    let hashedPassword = undefined;
    if (password && password.trim()) {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image || '');

    const memberData = {
      first_name: (first_name || '').trim(),
      middle_name: (middle_name || '').trim(),
      last_name: (last_name || '').trim(),
      number: (number || '').trim(),
      designation: (designation || '').trim(),
      image,
      status: status !== undefined ? Number(status) : 1
    };

    if (email && email.trim()) {
      const emailLower = email.trim().toLowerCase();
      const existingEmail = await CommitteeMember.findOne({ email: emailLower });
      if (existingEmail) {
        return apiResponse(res, 400, 'A committee member with this email already exists in this community.');
      }
      memberData.email = emailLower;
    }
    if (hashedPassword) {
      memberData.password = hashedPassword;
    }
    if (role_id && role_id.trim() && mongoose.isValidObjectId(role_id.trim())) {
      memberData.role_id = role_id.trim();
    }

    const committeeMember = new CommitteeMember(memberData);
    await committeeMember.save();

    return apiResponse(res, 201, 'Committee member created successfully', committeeMember);
  } catch (error) {
    console.error('Error creating committee member:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'number';
      return apiResponse(res, 400, `A committee member with this ${field} already exists.`);
    }
    return apiResponse(res, 500, error.message || 'Error creating committee member', { error: error.message });
  }
};

const updatecommitteeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    } else if (req.body.remove_image === 'true') {
      updateData.image = '';
    }

    if (updateData.password && updateData.password.trim()) {
      updateData.password = await bcrypt.hash(updateData.password.trim(), 10);
    } else {
      delete updateData.password;
    }

    if (updateData.email && updateData.email.trim()) {
      const emailLower = updateData.email.trim().toLowerCase();
      const existingEmail = await CommitteeMember.findOne({ email: emailLower, _id: { $ne: id } });
      if (existingEmail) {
        return apiResponse(res, 400, 'Another committee member with this email already exists in this community.');
      }
      updateData.email = emailLower;
    }

    if (!updateData.role_id) {
      delete updateData.role_id;
    }

    const committeeMember = await CommitteeMember.findByIdAndUpdate(id, updateData, { new: true }).populate('role_id');
    if (!committeeMember) {
      return apiResponse(res, 404, 'Committee member not found');
    }

    return apiResponse(res, 200, 'Committee member updated successfully', committeeMember);
  } catch (error) {
    return apiResponse(res, 500, 'Error updating committee member', { error: error.message });
  }
};

const deletecommitteeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const committeeMember = await CommitteeMember.findByIdAndDelete(id);
    if (!committeeMember) {
      return apiResponse(res, 404, 'Committee member not found');
    }

    return apiResponse(res, 200, 'Committee member deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting committee member', { error: error.message });
  }
};

const exportCommitteeMembers = async (req, res) => {
  try {
    let baseQuery = {};
    if (req.query.role) {
      const Role = require('../models/roleModel');
      const roleDoc = await Role.findOne({ name: req.query.role }).lean();
      if (roleDoc) {
        baseQuery.role_id = roleDoc._id;
      }
    }
    if (req.query.status !== undefined && req.query.status !== '') {
      baseQuery.status = Number(req.query.status);
    }
    if (req.query.search && String(req.query.search).trim()) {
      const searchRegex = new RegExp(String(req.query.search).trim(), 'i');
      baseQuery.$or = [
        { first_name: searchRegex },
        { middle_name: searchRegex },
        { last_name: searchRegex },
        { number: searchRegex },
        { email: searchRegex },
        { designation: searchRegex }
      ];
    }

    const members = await CommitteeMember.find(baseQuery)
      .sort({ createdAt: -1 })
      .populate('role_id')
      .lean();

    const columns = [
      { header: 'NAME', key: 'name', width: 36, align: 'left', bold: true },
      { header: 'MOBILE NUMBER', key: 'number', width: 20, align: 'center' },
      { header: 'EMAIL', key: 'email', width: 30, align: 'left' },
      { header: 'DESIGNATION', key: 'designation', width: 25, align: 'left', bold: true, color: 'FF1B365D' },
      { header: 'ASSIGNED ROLE', key: 'role', width: 25, align: 'center' },
      { header: 'STATUS', key: 'status', width: 15, align: 'center' }
    ];

    const rows = members.map((member) => {
      const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim();
      const roleName = member.role_id?.name || member.role_name || '-';
      const statusText = Number(member.status ?? 1) === 1 ? 'Active' : 'Inactive';

      return {
        name: fullName || '-',
        number: member.number ? String(member.number) : '',
        email: member.email || '',
        designation: member.designation || '-',
        role: roleName,
        status: statusText
      };
    });

    const { download_url, filename } = await generateExcelExport({
      req,
      filePrefix: 'Committee_Members',
      sheetName: 'Committee Members',
      columns,
      rows
    });

    return apiResponse(res, 200, 'Committee members exported successfully', {
      download_url,
      filename
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error exporting committee members', { error: error.message });
  }
};

const downloadExportedCommitteeMembers = (req, res) => {
  return sendExportedExcelFile(req, res);
};

const exportCommitteeMembersPdf = async (req, res) => {
  try {
    let baseQuery = {};
    if (req.query.role) {
      const Role = require('../models/roleModel');
      const roleDoc = await Role.findOne({ name: req.query.role }).lean();
      if (roleDoc) {
        baseQuery.role_id = roleDoc._id;
      }
    }
    if (req.query.status !== undefined && req.query.status !== '') {
      baseQuery.status = Number(req.query.status);
    }
    if (req.query.search && String(req.query.search).trim()) {
      const searchRegex = new RegExp(String(req.query.search).trim(), 'i');
      baseQuery.$or = [
        { first_name: searchRegex },
        { middle_name: searchRegex },
        { last_name: searchRegex },
        { number: searchRegex },
        { email: searchRegex },
        { designation: searchRegex }
      ];
    }

    const members = await CommitteeMember.find(baseQuery)
      .sort({ createdAt: -1 })
      .populate('role_id')
      .lean();

    // Fetch site/community branding config (logo, phone, email, name, colors)
    let config = null;
    try {
      config = await Config.findOne().lean();
    } catch (_) {}

    let logoUrl = req.query.logo || config?.webLogo || config?.appLogo || '';
    if (logoUrl && !logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
      logoUrl = publicUrl(req, logoUrl);
    }

    const branding = {
      name: config?.name || req.query.name || 'Parivar',
      logo: logoUrl,
      phone: req.query.phone || config?.phone || '',
      email: req.query.email || config?.email || '',
      primaryColor: '#1B365D',
      secondaryColor: '#42A5F5'
    };

    const columns = [
      { header: '#', key: 'sr', width: 35, align: 'center' },
      { header: 'MEMBER NAME', key: 'name', width: 175, align: 'left', bold: true },
      { header: 'MOBILE NUMBER', key: 'number', width: 105, align: 'center' },
      { header: 'EMAIL ADDRESS', key: 'email', width: 180, align: 'left' },
      { header: 'DESIGNATION', key: 'designation', width: 115, align: 'left', bold: true },
      { header: 'ASSIGNED ROLE', key: 'role', width: 95, align: 'center' },
      { header: 'STATUS', key: 'status', width: 65, align: 'center' }
    ];

    const rows = members.map((member, idx) => {
      const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim();
      const roleName = member.role_id?.name || member.role_name || '-';
      const statusText = Number(member.status ?? 1) === 1 ? 'Active' : 'Inactive';

      return {
        sr: idx + 1,
        name: fullName || '-',
        number: member.number ? String(member.number) : '-',
        email: member.email || '-',
        designation: member.designation || '-',
        role: roleName,
        status: statusText
      };
    });

    const { download_url, filename } = await generatePdfExport({
      req,
      filePrefix: 'Committee_Members',
      title: 'Committee Members Directory',
      columns,
      rows,
      branding,
      orientation: 'landscape'
    });

    return apiResponse(res, 200, 'Committee members PDF exported successfully', {
      download_url,
      filename
    });
  } catch (error) {
    console.error('Error exporting committee members PDF:', error);
    return apiResponse(res, 500, 'Error exporting committee members PDF', { error: error.message });
  }
};

const downloadExportedCommitteeMembersPdf = (req, res) => {
  return sendExportedPdfFile(req, res);
};

module.exports = {
  getcommitteeMembers,
  createcommitteeMember,
  updatecommitteeMember,
  deletecommitteeMember,
  exportCommitteeMembers,
  downloadExportedCommitteeMembers,
  exportCommitteeMembersPdf,
  downloadExportedCommitteeMembersPdf
};