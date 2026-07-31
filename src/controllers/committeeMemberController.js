const { apiResponse, publicUrl } = require("../utils/apiResponse");
const CommitteeMember = require('../models/committeeMemberModel');
const queryHelper = require("../utils/queryHelper");
const bcrypt = require('bcryptjs');

const getcommitteeMembers = async (req, res) => {
  try {
    const { data: committee, pagination } = await queryHelper(CommitteeMember, req.query, {
      searchFields: ['first_name', 'middle_name', 'last_name', 'number', 'email', 'designation'],
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
    const { first_name, middle_name, last_name, number, email, password, role_id, designation, image, status } = req.body;

    let hashedPassword = undefined;
    if (password && password.trim()) {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    const committeeMember = new CommitteeMember({
      first_name,
      middle_name,
      last_name,
      number,
      email: email ? email.trim().toLowerCase() : undefined,
      password: hashedPassword,
      role_id: role_id || undefined,
      designation,
      image,
      status: status !== undefined ? Number(status) : 1,
    });

    await committeeMember.save();

    return apiResponse(res, 201, 'Committee member created successfully', committeeMember);
  } catch (error) {
    return apiResponse(res, 500, 'Error creating committee member', { error: error.message });
  }
};

const updatecommitteeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (req.body.remove_image === 'true') {
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