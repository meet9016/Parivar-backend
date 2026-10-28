const mongoose = require('mongoose');
const Education = require('../models/educationModel');
const queryHelper = require('../utils/queryHelper');
const { apiResponse } = require('../utils/apiResponse');

const DEFAULT_EDUCATIONS = [
  // School
  { level: 'School', standard: '1st Standard', description: 'Primary School' },
  { level: 'School', standard: '2nd Standard', description: 'Primary School' },
  { level: 'School', standard: '3rd Standard', description: 'Primary School' },
  { level: 'School', standard: '4th Standard', description: 'Primary School' },
  { level: 'School', standard: '5th Standard', description: 'Primary School' },
  { level: 'School', standard: '6th Standard', description: 'Middle School' },
  { level: 'School', standard: '7th Standard', description: 'Middle School' },
  { level: 'School', standard: '8th Standard', description: 'Middle School' },
  { level: 'School', standard: '9th Standard', description: 'Secondary School' },
  { level: 'School', standard: '10th Standard (SSC)', description: 'Secondary School Certificate' },
  { level: 'School', standard: '11th Standard', description: 'Higher Secondary School' },
  { level: 'School', standard: '12th Standard (HSC)', description: 'Higher Secondary Certificate' },

  // Bachelor
  { level: 'Bachelor', standard: 'B.A.', description: 'Bachelor of Arts' },
  { level: 'Bachelor', standard: 'B.Com', description: 'Bachelor of Commerce' },
  { level: 'Bachelor', standard: 'B.Sc', description: 'Bachelor of Science' },
  { level: 'Bachelor', standard: 'B.Tech / B.E.', description: 'Bachelor of Technology / Engineering' },
  { level: 'Bachelor', standard: 'BBA', description: 'Bachelor of Business Administration' },
  { level: 'Bachelor', standard: 'BCA', description: 'Bachelor of Computer Applications' },
  { level: 'Bachelor', standard: 'MBBS / BDS', description: 'Bachelor of Medicine / Dental Surgery' },
  { level: 'Bachelor', standard: 'B.Pharm', description: 'Bachelor of Pharmacy' },
  { level: 'Bachelor', standard: 'LLB', description: 'Bachelor of Laws' },
  { level: 'Bachelor', standard: 'B.Ed', description: 'Bachelor of Education' },
  { level: 'Bachelor', standard: 'B.Des / B.Arch', description: 'Bachelor of Design / Architecture' },

  // Master
  { level: 'Master', standard: 'M.A.', description: 'Master of Arts' },
  { level: 'Master', standard: 'M.Com', description: 'Master of Commerce' },
  { level: 'Master', standard: 'M.Sc', description: 'Master of Science' },
  { level: 'Master', standard: 'M.Tech / M.E.', description: 'Master of Technology / Engineering' },
  { level: 'Master', standard: 'MBA', description: 'Master of Business Administration' },
  { level: 'Master', standard: 'MCA', description: 'Master of Computer Applications' },
  { level: 'Master', standard: 'MD / MS', description: 'Doctor of Medicine / Master of Surgery' },
  { level: 'Master', standard: 'M.Pharm', description: 'Master of Pharmacy' },
  { level: 'Master', standard: 'LLM', description: 'Master of Laws' },
  { level: 'Master', standard: 'Ph.D / Doctorate', description: 'Doctor of Philosophy' }
];

const formatEducation = (item) => ({
  id: String(item._id),
  custom_id: item.id || '',
  type: 'education',
  level: item.level || 'School',
  standard: item.standard || item.name || '',
  name: item.standard || item.name || '',
  description: item.description || '',
  status: Number(item.status ?? 1),
  createdAt: item.createdAt || '',
  updatedAt: item.updatedAt || ''
});

const isObjectId = (id) => mongoose.isValidObjectId(id);

const findById = (id) => Education.findOne({
  $or: [
    { id: String(id) },
    ...(isObjectId(id) ? [{ _id: id }, { _id: new mongoose.Types.ObjectId(id) }] : [])
  ]
});

const seedDefaultEducations = async () => {
  try {
    const count = await Education.countDocuments();
    if (count === 0) {
      const docs = DEFAULT_EDUCATIONS.map((ed, idx) => ({
        id: `EDU_${Date.now()}_${idx}`,
        level: ed.level,
        standard: ed.standard,
        name: ed.standard,
        description: ed.description,
        status: 1
      }));
      await Education.insertMany(docs);
    }
  } catch (err) {
    console.error('Error seeding default educations:', err.message);
  }
};

const getEducations = async (req, res) => {
  try {
    await seedDefaultEducations();

    const query = {};
    if (req.query.level) {
      query.level = String(req.query.level).trim();
    }
    if (req.query.status !== undefined && req.query.status !== null && req.query.status !== '') {
      const statusNum = Number(req.query.status);
      query.$or = [{ status: statusNum }, { status: String(statusNum) }];
    }

    const { data, pagination } = await queryHelper(Education, req.query, {
      baseQuery: query,
      searchFields: ['standard', 'name', 'level', 'description']
    });

    return apiResponse(
      res,
      200,
      'Education records retrieved successfully',
      data.map(formatEducation),
      pagination
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving education records', { error: error.message });
  }
};

const getEducationById = async (req, res) => {
  try {
    const doc = await findById(req.params.id);
    if (!doc) {
      return apiResponse(res, 404, 'Education record not found');
    }
    return apiResponse(res, 200, 'Education record retrieved successfully', formatEducation(doc.toObject()));
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving education record', { error: error.message });
  }
};

const saveEducation = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = id ? await findById(id) : null;

    if (id && !existing) {
      return apiResponse(res, 404, 'Education record not found');
    }

    const standard = req.body.standard || req.body.name || (existing ? existing.standard : '');
    const level = req.body.level || (existing ? existing.level : 'School');

    if (!standard || !String(standard).trim()) {
      return apiResponse(res, 400, 'Standard / Degree is required');
    }

    const trimmedStandard = String(standard).trim();
    const regex = new RegExp(`^${trimmedStandard.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');

    const duplicateQuery = {
      level,
      $or: [{ standard: regex }, { name: regex }]
    };
    if (existing) {
      duplicateQuery._id = { $ne: existing._id };
    }

    const duplicate = await Education.findOne(duplicateQuery);
    if (duplicate) {
      return apiResponse(res, 400, `"${trimmedStandard}" already exists for ${level}. Duplicate entries are not allowed.`);
    }

    const doc = existing || new Education();
    if (!existing) {
      doc.id = `EDU_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    doc.level = level;
    doc.standard = trimmedStandard;
    doc.name = trimmedStandard;
    if (req.body.description !== undefined) {
      doc.description = String(req.body.description).trim();
    }
    if (req.body.status !== undefined) {
      doc.status = Number(req.body.status);
    } else if (!existing) {
      doc.status = 1;
    }

    await doc.save();

    return apiResponse(
      res,
      existing ? 200 : 201,
      `Education record ${existing ? 'updated' : 'created'} successfully`,
      formatEducation(doc.toObject())
    );
  } catch (error) {
    return apiResponse(res, 500, 'Error saving education record', { error: error.message });
  }
};

const deleteEducation = async (req, res) => {
  try {
    const existing = await findById(req.params.id);
    if (!existing) {
      return apiResponse(res, 404, 'Education record not found');
    }
    await existing.deleteOne();
    return apiResponse(res, 200, 'Education record deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting education record', { error: error.message });
  }
};

const getLevels = async (req, res) => {
  try {
    const levels = [
      { key: 'School', label: 'School' },
      { key: 'Bachelor', label: 'Bachelor' },
      { key: 'Master', label: 'Master' },
      { key: 'Diploma', label: 'Diploma' },
      { key: 'Other', label: 'Other' }
    ];
    return apiResponse(res, 200, 'Education levels retrieved successfully', levels);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving education levels', { error: error.message });
  }
};

module.exports = {
  DEFAULT_EDUCATIONS,
  getEducations,
  getEducationById,
  saveEducation,
  deleteEducation,
  getLevels
};
