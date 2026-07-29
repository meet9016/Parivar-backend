const { apiResponse, publicUrl, memberPublicId } = require("../utils/apiResponse");

const CommitteeMember = require('../models/committeeMemberModel');
const queryHelper = require("../utils/queryHelper");

const getcommitteeMembers = async (req, res) => {
  try {
    const { data: committee, pagination } = await queryHelper(CommitteeMember, req.query, {
      searchFields: ['first_name', 'middle_name', 'last_name', 'number', 'designation'],
      defaultSort: { createdAt: -1 }
    });

    const data = committee.map((member) => ({
      id: String(member._id),
      first_name: member.first_name || '',
      middle_name: member.middle_name || '',
      last_name: member.last_name || '',
      number: member.number || '',
      designation: member.designation || '',
      image: publicUrl(req, member.signature || member.image || member.image || '')
    }));

    return apiResponse(res, 200, 'committee Memeber Data fetch successful', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving committee', { error: error.message });
  }
};

const createcommitteeMember = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, number, designation, image, status } = req.body;

    const committeeMember = new CommitteeMember({
      first_name,
      middle_name,
      last_name,
      number,
      designation,
      image,
      status,
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
    const updateData = req.body;
       if (req.body.remove_image === 'true') {
      updateData.image = ''
    }
    const committeeMember = await CommitteeMember.findByIdAndUpdate(id, updateData, { new: true });
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