const mongoose = require('mongoose');
const User = require('../models/userModels');
const CommitteeMember = require('../models/committeeMemberModel');

const cleanPhoneNumber = (number) => {
  if (!number) return '';
  return String(number).replace(/\D/g, '').slice(-10);
};

/**
 * Resolves all linked IDs for a given userId.
 * A person may exist in CommitteeMember (for Admin portal access) 
 * and in User (for general community member access) with the same mobile number.
 */
const getLinkedUserIds = async (userId) => {
  if (!userId) return { primaryId: null, allIds: [], isCommittee: false, user: null };

  const sId = String(userId);
  const oId = mongoose.isValidObjectId(sId) ? new mongoose.Types.ObjectId(sId) : null;
  const idQuery = oId ? { $in: [sId, oId] } : sId;

  // 1. Check CommitteeMember first
  const cm = await CommitteeMember.findOne({ _id: idQuery }).lean();
  if (cm) {
    const cleanNum = cleanPhoneNumber(cm.number);
    let linkedUser = null;
    if (cleanNum) {
      linkedUser = await User.findOne({
        number: { $regex: cleanNum + '$' }
      }).select('_id first_name last_name number').lean();
    }
    const all = [cm._id];
    if (linkedUser && String(linkedUser._id) !== sId) {
      all.push(linkedUser._id);
    }
    return {
      primaryId: cm._id,
      allIds: all,
      isCommittee: true,
      user: cm,
      linkedUser
    };
  }

  // 2. Check User
  const u = await User.findOne({ _id: idQuery }).lean();
  if (u) {
    const cleanNum = cleanPhoneNumber(u.number);
    let linkedCM = null;
    if (cleanNum) {
      linkedCM = await CommitteeMember.findOne({
        number: { $regex: cleanNum + '$' }
      }).select('_id first_name last_name number designation image profile_image').lean();
    }
    const all = [u._id];
    if (linkedCM && String(linkedCM._id) !== sId) {
      all.push(linkedCM._id);
    }
    return {
      // If a committee member profile exists, prefer it as primary for admin portal chat
      primaryId: linkedCM ? linkedCM._id : u._id,
      allIds: all,
      isCommittee: !!linkedCM,
      user: linkedCM || u,
      linkedUser: linkedCM ? u : null
    };
  }

  return {
    primaryId: oId || sId,
    allIds: [oId || sId],
    isCommittee: false,
    user: null
  };
};

module.exports = {
  getLinkedUserIds,
  cleanPhoneNumber
};
