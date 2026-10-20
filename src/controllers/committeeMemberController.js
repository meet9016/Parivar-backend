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
      searchFields: ['first_name', 'middle_name', 'last_name', 'number', 'email', 'designation', 'state', 'district', 'city', 'village'],
      filterFields: ['status', 'role_id', 'state_id', 'district_id', 'city_id', 'village_id'],
      defaultSort: { createdAt: -1 },
      populate: ['role_id']
    });

    // Batch lookup linked users and master villages to ensure clean village names
    const numbers = committee.map(m => m.number).filter(Boolean);
    const UserModel = req?.tenantConn ? (req.tenantConn.models.User || req.tenantConn.model('User', require('../models/userModels').schema)) : require('../models/userModels');
    const MasterModel = req?.tenantConn ? (req.tenantConn.models.Master || req.tenantConn.model('Master', require('../models/masterModel').schema)) : require('../models/masterModel');

    const [linkedUsers, allVillages] = await Promise.all([
      UserModel.find({ number: { $in: numbers } }).select('number village village_id village_name').lean().catch(() => []),
      MasterModel.find({ type: 'village' }).select('_id id name').lean().catch(() => [])
    ]);

    const userMap = new Map();
    (linkedUsers || []).forEach(u => {
      if (u.number) {
        const clean = String(u.number).trim().replace(/\D/g, '').slice(-10);
        userMap.set(clean, u);
      }
    });

    const villageMap = new Map();
    (allVillages || []).forEach(v => {
      villageMap.set(String(v._id), v.name);
      if (v.id) villageMap.set(String(v.id), v.name);
    });

    const data = committee.map((member) => {
      const cleanNum = String(member.number || '').trim().replace(/\D/g, '').slice(-10);
      const linkedUser = userMap.get(cleanNum);

      // Prioritize linked user's active village over cached member village
      let villageName = linkedUser?.village || linkedUser?.village_name || member.village || '';
      let villageId = linkedUser?.village_id || member.village_id || '';

      if (villageMap.has(String(villageName))) {
        villageId = villageName;
        villageName = villageMap.get(String(villageName));
      } else if (villageMap.has(String(villageId)) && !villageName) {
        villageName = villageMap.get(String(villageId));
      }

      return {
        id: String(member._id),
        first_name: member.first_name || '',
        middle_name: member.middle_name || '',
        last_name: member.last_name || '',
        number: member.number || '',
        email: member.email || '',
        role_id: member.role_id?._id ? String(member.role_id._id) : (member.role_id || ''),
        role_name: member.role_id?.name || '',
        designation: member.designation || '',
        state: member.state || linkedUser?.state || linkedUser?.state_name || '',
        state_id: member.state_id || linkedUser?.state_id || '',
        district: member.district || linkedUser?.district || linkedUser?.district_name || '',
        district_id: member.district_id || linkedUser?.district_id || '',
        city: member.city || linkedUser?.city || linkedUser?.city_name || '',
        city_id: member.city_id || linkedUser?.city_id || '',
        village: villageName || '',
        village_id: villageId || '',
        status: Number(member.status ?? 1),
        image: publicUrl(req, member.signature || member.image || '')
      };
    });

    return apiResponse(res, 200, 'committee Memeber Data fetch successful', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving committee', { error: error.message });
  }
};

const createcommitteeMember = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, number, email, password, role_id, designation, status, state, state_id, district, district_id, city, city_id, village, village_id } = req.body;

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
      state: (state || '').trim(),
      state_id: (state_id || '').trim(),
      district: (district || '').trim(),
      district_id: (district_id || '').trim(),
      city: (city || '').trim(),
      city_id: (city_id || '').trim(),
      village: (village || '').trim(),
      village_id: (village_id || '').trim(),
      image,
      status: status !== undefined ? Number(status) : 1
    };

    if (memberData.number) {
      try {
        const UserModel = req?.tenantConn ? (req.tenantConn.models.User || req.tenantConn.model('User', require('../models/userModels').schema)) : require('../models/userModels');
        const linkedUser = await UserModel.findOne({ number: memberData.number }).lean();
        if (linkedUser) {
          if (!memberData.village && (linkedUser.village || linkedUser.village_name)) {
            memberData.village = linkedUser.village || linkedUser.village_name;
            memberData.village_id = linkedUser.village_id || '';
          }
          if (!memberData.city_id && linkedUser.city_id) memberData.city_id = linkedUser.city_id;
          if (!memberData.city && (linkedUser.city || linkedUser.city_name)) memberData.city = linkedUser.city || linkedUser.city_name;
          if (!memberData.district_id && linkedUser.district_id) memberData.district_id = linkedUser.district_id;
          if (!memberData.district && (linkedUser.district || linkedUser.district_name)) memberData.district = linkedUser.district || linkedUser.district_name;
          if (!memberData.state_id && linkedUser.state_id) memberData.state_id = linkedUser.state_id;
          if (!memberData.state && (linkedUser.state || linkedUser.state_name)) memberData.state = linkedUser.state || linkedUser.state_name;
        }
      } catch (e) {
        console.warn('Could not auto-fetch location for committee member from User:', e.message);
      }
    }

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

    const UserModel = req?.tenantConn ? (req.tenantConn.models.User || req.tenantConn.model('User', require('../models/userModels').schema)) : require('../models/userModels');
    let memberPhone = updateData.number;
    if (!memberPhone && id) {
      const currentDoc = await CommitteeMember.findById(id).lean();
      memberPhone = currentDoc?.number;
    }
    const cleanPh = memberPhone ? String(memberPhone).trim().replace(/\D/g, '').slice(-10) : '';

    if (updateData.village !== undefined || updateData.village_id !== undefined) {
      // If village is explicitly provided/updated, also update the linked user
      if (cleanPh) {
        try {
          const userUpdate = {};
          if (updateData.village !== undefined) userUpdate.village = updateData.village;
          if (updateData.village_id !== undefined) userUpdate.village_id = updateData.village_id;
          await UserModel.updateMany(
            { number: { $regex: new RegExp(cleanPh + '$') } },
            { $set: userUpdate }
          );
        } catch (e) {
          console.warn('Could not sync committee village to User:', e.message);
        }
      }
    } else if (cleanPh) {
      // If village was not explicitly passed, sync from linked user if present
      try {
        const linkedUser = await UserModel.findOne({ number: { $regex: new RegExp(cleanPh + '$') } }).lean();
        if (linkedUser && (linkedUser.village || linkedUser.village_name)) {
          updateData.village = linkedUser.village || linkedUser.village_name;
          if (linkedUser.village_id) updateData.village_id = linkedUser.village_id;
        }
      } catch (e) {
        // ignore
      }
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