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

      let villageName = member.village || linkedUser?.village || linkedUser?.village_name || '';
      let villageId = member.village_id || linkedUser?.village_id || '';

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
    const { first_name, middle_name, last_name, number, email, password, role_id, designation, status, village, village_id } = req.body;

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
      village: (village || '').trim(),
      village_id: (village_id || '').trim(),
      image,
      status: status !== undefined ? Number(status) : 1
    };

    if (!memberData.village && memberData.number) {
      try {
        const UserModel = req?.tenantConn ? (req.tenantConn.models.User || req.tenantConn.model('User', require('../models/userModels').schema)) : require('../models/userModels');
        const linkedUser = await UserModel.findOne({ number: memberData.number }).lean();
        if (linkedUser) {
          if (linkedUser.village) memberData.village = linkedUser.village;
          if (linkedUser.village_id) memberData.village_id = linkedUser.village_id;
        }
      } catch (e) {
        console.warn('Could not auto-fetch village for committee member from User:', e.message);
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

    if (!updateData.village && (updateData.number || id)) {
      try {
        const UserModel = req?.tenantConn ? (req.tenantConn.models.User || req.tenantConn.model('User', require('../models/userModels').schema)) : require('../models/userModels');
        let ph = updateData.number;
        if (!ph) {
          const currentDoc = await CommitteeMember.findById(id).lean();
          ph = currentDoc?.number;
        }
        if (ph) {
          const linkedUser = await UserModel.findOne({ number: ph }).lean();
          if (linkedUser) {
            if (linkedUser.village) updateData.village = linkedUser.village;
            if (linkedUser.village_id) updateData.village_id = linkedUser.village_id;
          }
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