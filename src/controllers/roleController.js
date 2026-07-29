const mongoose = require('mongoose');
const Role = require('../models/roleModel');
const User = require('../models/userModels');
const { ACTIONS, ALL_PERMISSION_KEYS, PERMISSION_MODULES, PERMISSIONS } = require('../config/permissions');
const { apiResponse } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const sanitizePermissions = (permissions = []) => {
  const input = Array.isArray(permissions) ? permissions : String(permissions).split(',');
  return [...new Set(input.map((item) => String(item).trim()).filter((item) => ALL_PERMISSION_KEYS.includes(item)))];
};

const formatRole = (role) => ({
  id: String(role._id),
  name: role.name,
  permissions: role.permissions || [],
  permission_count: role.permissions?.length || 0,
  status: role.status ?? 1
});

const getPermissionOptions = async (req, res) => {
  return apiResponse(res, 200, 'Permission options retrieved successfully', {
    actions: ACTIONS,
    modules: PERMISSION_MODULES.map((module) => ({
      ...module,
      permissions: ACTIONS.map((action) => ({
        key: `${module.key}.${action.key}`,
        label: action.label,
        action: action.key
      }))
    })),
    permissions: PERMISSIONS
  });
};

const getRoles = async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(Role, req.query, {
      searchFields: ['name', 'permissions'],
      filterFields: ['name', 'status'],
      defaultSort: { name: 1 }
    });
    return apiResponse(res, 200, 'Roles retrieved successfully', data.map(formatRole), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving roles', { error: error.message });
  }
};

const saveRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name,  permissions, status } = req.body;

    if (!name || !String(name).trim()) {
      return apiResponse(res, 400, 'Role name is required');
    }

    const payload = {
      name: String(name).trim(),
      permissions: sanitizePermissions(permissions),
      status: status === undefined ? 1 : Number(status),
    
    };

    let role;
    if (id) {
      if (!mongoose.isValidObjectId(id)) {
        return apiResponse(res, 400, 'Invalid role id');
      }
      role = await Role.findOneAndUpdate({ _id: id }, payload, { new: true, runValidators: true });
      if (!role) {
        return apiResponse(res, 404, 'Role not found');
      }
    } else {
      role = await Role.create(payload);
    }

    return apiResponse(res, id ? 200 : 201, 'Role saved successfully', formatRole(role));
  } catch (error) {
    if (error.code === 11000) {
      return apiResponse(res, 409, 'Role name already exists');
    }
    return apiResponse(res, 500, 'Error saving role', { error: error.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return apiResponse(res, 400, 'Invalid role id');
    }

    const assignedUsers = await User.countDocuments({
      $and: [
        { role_id: id }
      ]
    });
    if (assignedUsers > 0) {
      return apiResponse(res, 409, 'Role is assigned to users and cannot be deleted');
    }

    const deleted = await Role.findOneAndDelete({ _id: id });
    if (!deleted) {
      return apiResponse(res, 404, 'Role not found');
    }

    return apiResponse(res, 200, 'Role deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting role', { error: error.message });
  }
};

module.exports = {
  deleteRole,
  getPermissionOptions,
  getRoles,
  saveRole
};
