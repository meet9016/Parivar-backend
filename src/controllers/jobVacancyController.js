const mongoose = require('mongoose');
const JobVacancy = require('../models/jobVacancy');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const { generateExcelExport, sendExportedExcelFile } = require('../utils/excelHelper');

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (req.body.remove_image === 'true') return '';
  return req.body.image || fallback || '';
};

const requestData = (req) => ({ ...req.query, ...req.body });

const buildIdQuery = (id) => ({
  $or: [
    { id: String(id) },
    { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }
  ]
});

const createdBy = (req) => {
  const user = req.user || {};
  const rawId = user._id || user.id || '';
  const validId = mongoose.isValidObjectId(String(rawId)) ? new mongoose.Types.ObjectId(String(rawId)) : null;
  return {
    id: validId,
    name: fullName(user) || user.name || user.username || user.email || ''
  };
};

const extractVacancyData = (data) => {
  const { title, description, qualifications, company_name, location, job_type, salary, contact_email, contact_number, status } = data;
  return { title, description, qualifications, company_name, location, job_type, salary, contact_email, contact_number, status };
};

const checkIsOwn = (item, user) => {
  if (!user) return false;
  const userIds = new Set([
    String(user._id || ''),
    String(user.id || ''),
    String(user.member_id || '')
  ].filter(Boolean));

  const itemIds = [
    String(item.created_by?.id || ''),
    String(item.member_id || '')
  ].filter(Boolean);

  return itemIds.some(id => userIds.has(id));
};

const getJobVacancies = async (req, res) => {
  try {
    let baseQuery = {};
    const { is_own } = req.query;
    const user = req.user;

    if (user) {
      const userIds = [
        String(user._id || ''),
        String(user.id || ''),
        String(user.member_id || '')
      ].filter(Boolean);

      const validObjectIds = userIds
        .filter(id => mongoose.isValidObjectId(id))
        .map(id => new mongoose.Types.ObjectId(id));

      if (is_own === 'true') {
        baseQuery.$or = [
          { 'created_by.id': { $in: validObjectIds } },
          { member_id: { $in: userIds } }
        ];
        delete req.query.status;
      } else if (req.query.status === undefined || req.query.status === null || req.query.status === '') {
        baseQuery.$or = [
          { status: 1 },
          { status: '1' },
          { status: { $exists: false } },
          { status: null },
          { 'created_by.id': { $in: validObjectIds } },
          { member_id: { $in: userIds } }
        ];
      }
    }
    const { data: jobVacancies, pagination } = await queryHelper(JobVacancy, req.query, {
      baseQuery,
      searchFields: ['title', 'company_name', 'location', 'description', 'qualifications'],
      filterFields: ['job_type', 'status'],
      defaultSort: { createdAt: -1 },
      lean: false
    });
    const data = jobVacancies.map((job) => ({
      ...job.toObject ? job.toObject() : job,
      image: publicUrl(req, job.image || ''),
      is_own: checkIsOwn(job, req.user)
    }));
    return apiResponse(res, 200, "Job vacancies retrieved successfully", data, pagination);


  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving Vacancies', { error: error.message });
  }
};

const getJobVacancyById = async (req, res) => {
  try {
    const { id } = req.params;
    const jobVacancy = await JobVacancy.findOne(buildIdQuery(id));
    if (!jobVacancy) return apiResponse(res, 404, "Job Vacancy not found");

    return apiResponse(res, 200, "Job vacancy retrieved successfully", {
      ...jobVacancy.toObject ? jobVacancy.toObject() : jobVacancy,
      image: publicUrl(req, jobVacancy.image || ''),
      is_own: String(req.user?._id) === String(jobVacancy.created_by?.id)
    });

  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving vacancy', { error: error.message });
  }
};

const postJobVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    const body = requestData(req);

    if (id) {
      const existing = await JobVacancy.findOne(buildIdQuery(id));
      if (!existing) return apiResponse(res, 404, "Job Vacancy not found");

      // Merge only provided fields for update (allows single field updates like status)
      const allowedFields = ['title', 'description', 'qualifications', 'company_name', 'location', 'job_type', 'salary', 'contact_email', 'contact_number', 'status'];
      allowedFields.forEach((field) => {
        if (body[field] !== undefined && body[field] !== null) {
          existing.set(field, body[field]);
        }
      });

      if (req.file || body.image || body.remove_image === 'true') {
        existing.set('image', imageFromRequest(req, existing.image));
      }

      await existing.save();
      return apiResponse(res, 200, "Job Vacancy updated successfully", {
        ...existing.toObject(),
        image: publicUrl(req, existing.image || ''),
        is_own: String(req.user?._id) === String(existing.created_by?.id)
      });
    }

    const userId = req.user?._id || req.user?.id;
    if (!userId || !mongoose.isValidObjectId(String(userId))) {
      return apiResponse(res, 400, "Invalid creator user ID format. Must be a valid MongoDB ObjectId.");
    }

    const jobVacancyData = extractVacancyData(body);
    const jobVacancy = await JobVacancy.create({
      ...jobVacancyData,
      image: imageFromRequest(req),
      created_by: createdBy(req)
    });
    return apiResponse(res, 201, "Job Vacancy created successfully", {
      ...jobVacancy.toObject(),
      image: publicUrl(req, jobVacancy.image || ''),
      is_own: true
    });
  } catch (error) {
    return apiResponse(res, 500, "Failed to save job vacancy", { error: error.message });
  }
};

const deleteJobVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    const jobVacancy = await JobVacancy.findOneAndDelete(buildIdQuery(id));
    if (!jobVacancy) return apiResponse(res, 404, "Job Vacancy not found");
    return apiResponse(res, 200, "Job Vacancy deleted successfully");
  } catch (error) {
    return apiResponse(res, 500, "Failed to delete job vacancy", { error: error.message });
  }
};

const exportJobVacancies = async (req, res) => {
  try {
    let baseQuery = {};
    const { is_own, search, status, job_type } = req.query;
    const user = req.user;

    if (user && is_own === 'true') {
      const userIds = [
        String(user._id || ''),
        String(user.id || ''),
        String(user.member_id || '')
      ].filter(Boolean);

      const validObjectIds = userIds
        .filter(id => mongoose.isValidObjectId(id))
        .map(id => new mongoose.Types.ObjectId(id));

      baseQuery.$or = [
        { 'created_by.id': { $in: validObjectIds } },
        { member_id: { $in: userIds } }
      ];
    }

    if (status !== undefined && status !== null && status !== '') {
      baseQuery.status = Number(status);
    }
    if (job_type) {
      baseQuery.job_type = String(job_type);
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      baseQuery.$or = [
        { title: searchRegex },
        { company_name: searchRegex },
        { location: searchRegex },
        { description: searchRegex },
        { qualifications: searchRegex },
        { contact_number: searchRegex },
        { contact_email: searchRegex }
      ];
    }

    const jobVacancies = await JobVacancy.find(baseQuery).sort({ createdAt: -1 }).lean();

    const formatJobType = (type) => {
      if (!type) return '-';
      const map = {
        'full-time': 'Full Time',
        'part-time': 'Part Time',
        'contract': 'Contract',
        'internship': 'Internship'
      };
      return map[String(type).toLowerCase()] || type;
    };

    const columns = [
      { header: 'JOB TITLE', key: 'title', width: 30, align: 'left', bold: true },
      { header: 'COMPANY', key: 'company_name', width: 28, align: 'left' },
      { header: 'LOCATION', key: 'location', width: 24, align: 'left' },
      { header: 'JOB TYPE', key: 'job_type', width: 16, align: 'center' },
      { header: 'SALARY', key: 'salary', width: 20, align: 'center' },
      { header: 'CONTACT NUMBER', key: 'contact_number', width: 18, align: 'center' },
      { header: 'CONTACT EMAIL', key: 'contact_email', width: 28, align: 'left' },
      { header: 'QUALIFICATIONS', key: 'qualifications', width: 32, align: 'left' },
      { header: 'DESCRIPTION', key: 'description', width: 40, align: 'left' },
      { header: 'POSTED BY', key: 'posted_by', width: 24, align: 'left' },
      { header: 'STATUS', key: 'status', width: 14, align: 'center' }
    ];

    const rows = jobVacancies.map(job => ({
      title: job.title || '-',
      company_name: job.company_name || '-',
      location: job.location || '-',
      job_type: formatJobType(job.job_type),
      salary: job.salary || '-',
      contact_number: job.contact_number ? String(job.contact_number) : '',
      contact_email: job.contact_email || '',
      qualifications: job.qualifications || '-',
      description: job.description || '-',
      posted_by: job.created_by?.name || '-',
      status: Number(job.status ?? 0) === 1 ? 'Active' : 'Inactive'
    }));

    const { download_url, filename } = await generateExcelExport({
      req,
      filePrefix: 'Job_Vacancies',
      sheetName: 'Job Vacancies',
      columns,
      rows
    });

    return apiResponse(res, 200, 'Job vacancies exported successfully', {
      download_url,
      filename
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error exporting job vacancies', { error: error.message });
  }
};

const downloadExportedJobVacancies = (req, res) => {
  return sendExportedExcelFile(req, res);
};

module.exports = { 
  getJobVacancies, 
  getJobVacancyById, 
  postJobVacancy, 
  deleteJobVacancy,
  exportJobVacancies,
  downloadExportedJobVacancies
};
