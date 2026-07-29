const mongoose = require('mongoose');
const Matrimony = require('../models/matrimonyModel');
const { apiResponse, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const getMatrimonies = async (req, res) => {
  try {
    let baseQuery = {};
    const { is_own } = req.query;
    if (is_own === 'true' && req.user) {
      baseQuery.member_id = req.user.member_id || String(req.user._id);
    } else {
      // By default, for non-own fetches, admins can see all, users only see active ones.
      // But typically we show status=1 if not specified. Wait, if it's Admin software, they might pass status directly.
      // If we don't force baseQuery.status = 1 here, Admin can see all (since queryHelper allows filtering by status).
      // If they explicitly pass status=1 it will filter. Let's not force status=1 here so Admin can see pending.
      // Wait, user says "bydefault status is pending admin approva kare pachi list ma show thase." This means for normal users, they should only see status=1.
      // In the admin panel, they might fetch all. We'll rely on the frontend to pass `status=1` if it's the app, or admin will just fetch without `status`.
    }

    const { data: matrimonies, pagination } = await queryHelper(Matrimony, requestData(req), {
      baseQuery,
      searchFields: ['full_name', 'city', 'education', 'occupation', 'father_name', 'mother_name', 'gotra', 'mobile_number'],
      filterFields: ['full_name', 'city', 'gender', 'marital_status', 'family_type', 'status']
    });

    return res.status(200).json({
      status: 200,
      message: 'Matrimony records retrieved successfully',
      data: matrimonies.map((item) => ({
        id: item.id || String(item._id),
        full_name: item.full_name || '',
        gender: item.gender || '',
        birthdate: item.birthdate || '',
        marital_status: item.marital_status || '',
        height: item.height || '',
        weight: item.weight || '',
        complexion: item.complexion || '',
        education: item.education || '',
        occupation: item.occupation || '',
        father_name: item.father_name || '',
        mother_name: item.mother_name || '',
        gotra: item.gotra || '',
        family_type: item.family_type || '',
        mobile_number: item.mobile_number || '',
        city: item.city || '',
        about: item.about || '',
        biodata: item.biodata || '',
        person_image: item.person_image || '',
        member_id: item.member_id || '',
        is_own: req.user ? (String(item.member_id) === String(req.user.member_id || req.user._id)) : false,
        status: Number(item.status ?? 0)
      })),
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving matrimony records', { error: error.message });
  }
};

const getMatrimonyById = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const matrimony = await Matrimony.findOne({ $or: orConditions }).lean();

    if (!matrimony) {
      return apiResponse(res, 404, 'Matrimony record not found');
    }

    return res.status(200).json({
      status: 200,
      message: 'Matrimony record retrieved successfully',
      data: {
        id: matrimony.id || String(matrimony._id),
        full_name: matrimony.full_name || '',
        gender: matrimony.gender || '',
        birthdate: matrimony.birthdate || '',
        marital_status: matrimony.marital_status || '',
        height: matrimony.height || '',
        weight: matrimony.weight || '',
        complexion: matrimony.complexion || '',
        education: matrimony.education || '',
        occupation: matrimony.occupation || '',
        father_name: matrimony.father_name || '',
        mother_name: matrimony.mother_name || '',
        gotra: matrimony.gotra || '',
        family_type: matrimony.family_type || '',
        mobile_number: matrimony.mobile_number || '',
        city: matrimony.city || '',
        about: matrimony.about || '',
        biodata: matrimony.biodata || '',
        person_image: matrimony.person_image || '',
        member_id: matrimony.member_id || '',
        is_own: req.user ? (String(matrimony.member_id) === String(req.user.member_id || req.user._id)) : false,
        status: Number(matrimony.status ?? 0)
      }
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving matrimony record', { error: error.message });
  }
};

const addMatrimony = async (req, res) => {
  try {
    const {
      full_name,
      gender,
      birthdate,
      marital_status,
      height,
      weight,
      complexion,
      education,
      occupation,
      father_name,
      mother_name,
      gotra,
      family_type,
      mobile_number,
      city,
      about,
      biodata,
      person_image,
      status
    } = requestData(req);

    if (!full_name || !gender || !birthdate || !marital_status || !height || !weight || !complexion || !education || !occupation || !father_name || !mother_name || !gotra || !family_type || !mobile_number || !city) {
      return apiResponse(res, 400, 'All required matrimony fields must be provided');
    }

    const data = {
      id: `MAT${Date.now()}`,
      full_name,
      gender,
      birthdate,
      marital_status,
      height,
      weight,
      complexion,
      education,
      occupation,
      father_name,
      mother_name,
      gotra,
      family_type,
      mobile_number,
      city,
      about: about || '',
      biodata: biodata || '',
      person_image: person_image || '',
      member_id: req.user ? (req.user.member_id || String(req.user._id)) : '',
      status: status === undefined ? 0 : Number(status),
      cdate: new Date().toISOString().slice(0, 10)
    };

    const matrimonial = await Matrimony.create(data);
    return res.status(201).json({
      status: 201,
      message: 'Matrimony record created successfully',
      data: {
        id: matrimonial.id || String(matrimonial._id),
        full_name: matrimonial.full_name,
        gender: matrimonial.gender,
        birthdate: matrimonial.birthdate,
        marital_status: matrimonial.marital_status,
        height: matrimonial.height,
        weight: matrimonial.weight,
        complexion: matrimonial.complexion,
        education: matrimonial.education,
        occupation: matrimonial.occupation,
        father_name: matrimonial.father_name,
        mother_name: matrimonial.mother_name,
        gotra: matrimonial.gotra,
        family_type: matrimonial.family_type,
        mobile_number: matrimonial.mobile_number,
        city: matrimonial.city,
        about: matrimonial.about || '',
        biodata: matrimonial.biodata || '',
        person_image: matrimonial.person_image || '',
        member_id: matrimonial.member_id || '',
        status: Number(matrimonial.status ?? 0)
      }
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error adding matrimony record', { error: error.message });
  }
};

const updateMatrimony = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const matrimony = await Matrimony.findOne({ $or: orConditions });

    if (!matrimony) {
      return apiResponse(res, 404, 'Matrimony record not found');
    }

    const updates = requestData(req);
    const fields = [
      'full_name',
      'gender',
      'birthdate',
      'marital_status',
      'height',
      'weight',
      'complexion',
      'education',
      'occupation',
      'father_name',
      'mother_name',
      'gotra',
      'family_type',
      'mobile_number',
      'city',
      'about',
      'biodata',
      'person_image'
    ];

    fields.forEach((field) => {
      if (updates[field] !== undefined) {
        matrimony[field] = updates[field];
      }
    });

    if (updates.status !== undefined) {
      matrimony.status = Number(updates.status);
    }

    await matrimony.save();
    return apiResponse(res, 200, 'Matrimony record updated successfully', {
      id: matrimony.id || String(matrimony._id),
      full_name: matrimony.full_name,
      gender: matrimony.gender,
      birthdate: matrimony.birthdate,
      marital_status: matrimony.marital_status,
      height: matrimony.height,
      weight: matrimony.weight,
      complexion: matrimony.complexion,
      education: matrimony.education,
      occupation: matrimony.occupation,
      father_name: matrimony.father_name,
      mother_name: matrimony.mother_name,
      gotra: matrimony.gotra,
      family_type: matrimony.family_type,
      mobile_number: matrimony.mobile_number,
      city: matrimony.city,
      about: matrimony.about || '',
      biodata: matrimony.biodata || '',
      person_image: matrimony.person_image || '',
      member_id: matrimony.member_id || '',
      status: Number(matrimony.status ?? 0)
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error updating matrimony record', { error: error.message });
  }
};

const deleteMatrimony = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [{ id }];
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }

    const result = await Matrimony.deleteOne({ $or: orConditions });

    if (result.deletedCount === 0) {
      return apiResponse(res, 404, 'Matrimony record not found');
    }

    return apiResponse(res, 200, 'Matrimony record deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting matrimony record', { error: error.message });
  }
};

module.exports = {
  getMatrimonies,
  getMatrimonyById,
  addMatrimony,
  updateMatrimony,
  deleteMatrimony
};
