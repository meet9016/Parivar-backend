const mongoose = require('mongoose');
const User = require('../models/userModels');

const fullName = (user = {}) => [user.first_name, user.middle_name, user.last_name]
  .filter(Boolean)
  .join(' ') || '';

const findUserByIdOrMemberId = async (id) => {
  if (!id) return null;

  const query = {};
  if (mongoose.isValidObjectId(id)) {
    query.$or = [{ _id: id }, { member_id: id }];
  } else {
    query.member_id = id;
  }

  return await User.findOne(query).lean();
};

const getFamilyHeadFromParent = async (parentUser) => {
  if (!parentUser) return null;
  if (parentUser.relation === 'Self') {
    return parentUser;
  }

  if (parentUser.family_head?.id) {
    return await findUserByIdOrMemberId(String(parentUser.family_head.id));
  }

  return null;
};

const resolveFamilyHead = async ({ relation, family_head_id }) => {
  if (relation === 'Self') {
    return { family_head: null, head: null };
  }

  const cleanId = String(family_head_id || '').trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
    throw new Error('Family head information is required for non-self members');
  }

  const head = await findUserByIdOrMemberId(cleanId);
  if (!head) {
    throw new Error('Invalid family_head_id');
  }

  return {
    family_head: {
      id: head._id,
      name: fullName(head)
    },
    head
  };
};

const prepareFamilyFields = async (payload = {}, existing = {}) => {
  let relation = payload.relation || existing.relation || 'Self';
  
  if (Array.isArray(relation)) {
    relation = relation.find(r => typeof r === 'string' && r.trim() !== '') || relation[0] || 'Self';
  }


  const isSelf = relation === 'Self';

  const result = {
    relation,
    family_head: existing.family_head || null,
    status: existing.status !== undefined ? Number(existing.status) : undefined
  };

  const isHead = payload.familyHead !== undefined 
    ? (payload.familyHead === true || payload.familyHead === 'true') 
    : (existing.familyHead === true || isSelf);

  if (isHead) {
    if (payload.family_head_id) {
      throw new Error('Family head cannot have a family head reference');
    }

    result.family_head = null;
    result.status = payload.status === undefined ? 0 : Number(payload.status);
    return result;
  }

  const headData = await resolveFamilyHead({
    relation,
    family_head_id: payload.family_head_id || existing.family_head?.id
  });

  result.family_head = headData.family_head;
  result.status = payload.status === undefined ? 1 : Number(payload.status);

  return result;
};

module.exports = {
  fullName,
  findUserByIdOrMemberId,
  resolveFamilyHead,
  prepareFamilyFields
};
