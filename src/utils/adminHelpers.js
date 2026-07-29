const mongoose = require('mongoose');
const Role = require('../models/roleModel');

const splitFullName = (value = '') => {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', middle_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], middle_name: '', last_name: '' };
  if (parts.length === 2) return { first_name: parts[0], middle_name: '', last_name: parts[1] };
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(' '),
    last_name: parts[parts.length - 1]
  };
};

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  return req.body.image || fallback || '';
};

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const recoveryKeyFromRequest = (req) => (
  req.headers['x-admin-recovery-key']
  || req.headers['x-recovery-key']
  || req.body?.recovery_key
  || req.query?.recovery_key
);

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const adminRecoveryQuery = ({ id,  email, number }) => {
  const query = [];

  if (id) {
    if (mongoose.isValidObjectId(id)) {
      query.push({ _id: id });
    }
    query.push({ _id: String(id) });
  }

  if (email) query.push({ email: String(email).toLowerCase() });
  if (number) query.push({ number: String(number) });

  return query.length ? { $or: query } : null;
};

const resolveRecoveryRoleId = async ({ role_id, role_name }) => {
  if (role_id !== undefined) {
    if (!role_id) {
      return null;
    }

    if (!mongoose.isValidObjectId(role_id)) {
      const error = new Error('Invalid role id');
      error.status = 400;
      throw error;
    }

    return role_id;
  }

  if (!role_name) {
    return undefined;
  }

  const role = await Role.findOne({ name: new RegExp(`^${escapeRegExp(role_name).trim()}$`, 'i') });
  if (!role) {
    const error = new Error('Role not found');
    error.status = 404;
    throw error;
  }

  return role._id;
};

module.exports = {
  splitFullName,
  imageFromRequest,
  requestData,
  recoveryKeyFromRequest,
  escapeRegExp,
  adminRecoveryQuery,
  resolveRecoveryRoleId
};
