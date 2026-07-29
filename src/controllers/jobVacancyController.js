const mongoose = require('mongoose');
const JobVacancy = require('../models/jobVacancy');
const { apiResponse, fullName,publicUrl  } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

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
  return {
    id: user._id || user.id || '',
    name: fullName(user) || user.name || user.username || user.email || ''
  };
};

const buildSearchQuery = ({ search, job_type }) => {
  const query = {};
  if (job_type) query.job_type = job_type;
  if (search) {
    query.$or = [
      { title: new RegExp(search, 'i') },
      { company_name: new RegExp(search, 'i') },
      { location: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') }
    ];
  }
  return query;
};

const extractVacancyData = (data) => {
  const { title, description, qualifications, company_name, location, job_type, salary, contact_email, contact_number, status } = data;
  return { title, description, qualifications, company_name, location, job_type, salary, contact_email, contact_number, status };
};

const getJobVacancies = async (req, res) => {
  try {
    const { data: jobVacancies, pagination } = await queryHelper(JobVacancy, requestData(req), {
      searchFields: ['title', 'company_name', 'location', 'description', 'qualifications'],
      filterFields: ['job_type', 'status'],
      defaultSort: { createdAt: -1 },
      lean: false
    });
  const data = jobVacancies.map((job) => ({
  ...job.toObject ? job.toObject() : job,
  image: publicUrl(req, job.image || ''),
  is_own: String(req.user?._id) === String(job.created_by?.id)
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
    const jobVacancyData = extractVacancyData(requestData(req));

    if (id) {
      const existing = await JobVacancy.findOne(buildIdQuery(id));
      if (!existing) return apiResponse(res, 404, "Job Vacancy not found");
      existing.set({ ...jobVacancyData, image: imageFromRequest(req, existing.image) });
      await existing.save();
      return apiResponse(res, 200, "Job Vacancy updated successfully", {
        ...existing.toObject(),
        image: publicUrl(req, existing.image || ''),
        is_own: String(req.user?._id) === String(existing.created_by?.id)
      });
    }

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

module.exports = { getJobVacancies, getJobVacancyById, postJobVacancy, deleteJobVacancy }
