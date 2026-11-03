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

const resolveFamilyHead = async ({ relation, family_head_id, is_deceased = false }) => {
  if (relation === 'Self' || is_deceased) {
    return { family_head: null, head: null };
  }

  const cleanId = String(family_head_id || '').trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
    if (is_deceased) {
      return { family_head: null, head: null };
    }
    throw new Error('Family head information is required for non-self members');
  }

  const head = await findUserByIdOrMemberId(cleanId);
  if (!head) {
    if (is_deceased) {
      return { family_head: null, head: null };
    }
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
  const isDeceased = payload.is_deceased === true || payload.is_deceased === 'true' || existing.is_deceased === true;

  const result = {
    relation,
    family_head: existing.family_head || null,
    status: existing.status !== undefined ? Number(existing.status) : undefined
  };

  const isHead = payload.familyHead !== undefined 
    ? (payload.familyHead === true || payload.familyHead === 'true') 
    : (existing.familyHead === true || isSelf || isDeceased);

  if (isHead) {
    if (payload.family_head_id && !isDeceased) {
      throw new Error('Family head cannot have a family head reference');
    }

    result.family_head = null;
    result.status = payload.status === undefined ? 0 : Number(payload.status);
    return result;
  }

  const headData = await resolveFamilyHead({
    relation,
    family_head_id: payload.family_head_id || existing.family_head?.id,
    is_deceased: isDeceased
  });

  result.family_head = headData.family_head;
  result.status = payload.status === undefined ? 1 : Number(payload.status);

  return result;
};

const areInSameFamily = (userA, userB, userAFamilyHeadId = null) => {
  if (!userA || !userB) return false;
  const idA = String(userA._id || userA.id || '');
  const idB = String(userB._id || userB.id || '');
  if (idA && idB && idA === idB) return true;

  const extractHeadId = (u, overrideHeadId) => {
    if (overrideHeadId) return String(overrideHeadId);
    if (!u) return '';
    let headRef = u.family_head?.id || u.family_head?._id;
    if (!headRef && u.family_head && mongoose.isValidObjectId(u.family_head)) {
      headRef = u.family_head;
    }
    if (headRef && typeof headRef === 'object' && headRef._id) {
      headRef = headRef._id;
    }
    const uId = String(u._id || u.id || '');
    if (headRef && String(headRef) !== uId) {
      return String(headRef);
    }
    if (u.familyHead || u.relation === 'Self') {
      return uId;
    }
    return headRef ? String(headRef) : uId;
  };

  const headA = extractHeadId(userA, userAFamilyHeadId);
  const headB = extractHeadId(userB);

  if (headA && headB && headA === headB) return true;

  // Also check parent_member_id / member_id linkage if present
  if (userA.member_id && userB.parent_member_id && String(userB.parent_member_id) === String(userA.member_id)) return true;
  if (userB.member_id && userA.parent_member_id && String(userA.parent_member_id) === String(userB.member_id)) return true;
  if (userA.parent_member_id && userB.parent_member_id && String(userA.parent_member_id) === String(userB.parent_member_id)) return true;

  return false;
};

module.exports = {
  fullName,
  findUserByIdOrMemberId,
  resolveFamilyHead,
  prepareFamilyFields,
  areInSameFamily
};
