const mongoose = require('mongoose');
const { apiResponse, publicUrl } = require("../utils/apiResponse");
const CommitteeMember = require('../models/committeeMemberModel');
const queryHelper = require("../utils/queryHelper");
const bcrypt = require('bcryptjs');

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
      memberData.email = email.trim().toLowerCase();
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

    if (updateData.email) {
      updateData.email = updateData.email.trim().toLowerCase();
    }

    if (!updateData.role_id) {
      delete updateData.role_id;
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



module.exports = {
  getcommitteeMembers,
  createcommitteeMember,
  updatecommitteeMember,
  deletecommitteeMember

};