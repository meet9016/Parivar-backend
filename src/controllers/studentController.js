const mongoose = require('mongoose');
const Student = require('../models/studentModel');
const { apiResponse, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const getStudents = async (req, res) => {
  try {
    const { data: students, pagination } = await queryHelper(Student, requestData(req), {
      searchFields: ['surname', 'student_name', 'father_name', 'school_name', 'standard', 'mobile_number','year'],
      filterFields: ['standard', 'student_name', 'school_name', 'status','year','user_id']
    });
    
    return res.status(200).json({
      status: 200,
      message: 'Students retrieved successfully',
      data: students.map(s => ({
        id: s._id || String(s._id),
        surname: s.surname || '',
        student_name: s.student_name || '',
        father_name: s.father_name || '',
        school_name: s.school_name || '',
        standard: s.standard || '',
        percentage: s.percentage || '',
        mobile_number: s.mobile_number || '',
        mobile_number_2: s.mobile_number_2 || '',
        result_image: publicUrl(req, s.result_image || ''),
        student_image: publicUrl(req, s.student_image || ''),
        year: s.year || '',
        is_own: req.user ? String(s.user_id) === String(req.user._id) : false,
        status: Number(s.status ?? 0),
        createdAt: s.createdAt || s.cdate || ''
      })),
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error retrieving students',
      data: [],
      error: error.message
    });
  }
};

const addStudent = async (req, res) => {
  try {
    const {
      surname,
      student_name,
      father_name,
      school_name,
      standard,
      percentage,
      mobile_number,
      mobile_number_2,
      result_image,
      student_image,
      year,
      status
    } = requestData(req);

    if (!surname || !student_name || !school_name || !standard || !percentage || !mobile_number || !year) {
      return res.status(400).json({
        status: 400,
        message: 'All required fields are mandatory',
        data: []
      });
    }

    const studentData = {
      
      surname,
      student_name,
      father_name,
      school_name,
      standard,
      percentage,
      mobile_number,
      mobile_number_2: mobile_number_2 || '',
      result_image: result_image || '',
      student_image: student_image || '',
      year: year || '',
      user_id: req.user ? req.user._id : null,
      status: status === undefined ? 0 : Number(status),
      cdate: new Date().toISOString().slice(0, 10)
    };

    const student = await Student.create(studentData);
    return res.status(201).json({
      status: 201,
      message: 'Student added successfully',
      data: {
        id: student._id || String(student._id),
        surname: student.surname || '',
        student_name: student.student_name || '',
        father_name: student.father_name || '',
        school_name: student.school_name || '',
        standard: student.standard || '',
        percentage: student.percentage || '',
        mobile_number: student.mobile_number || '',
        mobile_number_2: student.mobile_number_2 || '',
        result_image: publicUrl(req, student.result_image || ''),
        student_image: publicUrl(req, student.student_image || ''),
        year: student.year || '',
        is_own: true,
        status: Number(student.status ?? 0),
        createdAt: student.createdAt || student.cdate || ''
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error adding student',
      data: [],
      error: error.message
    });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [];
    orConditions.push({ id });
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }
    
    const student = await Student.findOne({
      $or: orConditions
    });

    if (!student) {
      return res.status(404).json({
        status: 404,
        message: 'Student not found',
        data: []
      });
    }

    const {
      surname,
      student_name,
      father_name,
      school_name,
      standard,
      percentage,
      mobile_number,
      mobile_number_2,
      result_image,
      student_image,
      year,
      status,
    } = requestData(req);

    if (surname) student.surname = surname;
    if (student_name) student.student_name = student_name;
    if (father_name) student.father_name = father_name;
    if (school_name) student.school_name = school_name;
    if (standard) student.standard = standard;
    if (percentage) student.percentage = percentage;
    if (mobile_number) student.mobile_number = mobile_number;
    if (mobile_number_2 !== undefined) student.mobile_number_2 = mobile_number_2;
    if (result_image) student.result_image = result_image;
    if (student_image) student.student_image = student_image;
    if (year) student.year = year;
    if (status !== undefined) student.status = Number(status);

    await student.save();
    return res.status(200).json({
      status: 200,
      message: 'Student updated successfully',
      data: {
        id: student.id || String(student._id),
        surname: student.surname || '',
        student_name: student.student_name || '',
        father_name: student.father_name || '',
        school_name: student.school_name || '',
        standard: student.standard || '',
        percentage: student.percentage || '',
        mobile_number: student.mobile_number || '',
        mobile_number_2: student.mobile_number_2 || '',
        result_image: publicUrl(req, student.result_image || ''),
        student_image: publicUrl(req, student.student_image || ''),
        year: student.year || '',
        is_own: req.user ? String(student.user_id) === String(req.user._id) : false,
        status: Number(student.status ?? 0),
        createdAt: student.createdAt || student.cdate || ''
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error updating student',
      data: [],
      error: error.message
    });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const orConditions = [];
    orConditions.push({ id });
    if (mongoose.isValidObjectId(id)) {
      orConditions.push({ _id: id });
    }
    
    const result = await Student.deleteOne({
      $or: orConditions
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 404,
        message: 'Student not found',
        data: []
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Student deleted successfully',
      data: []
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Error deleting student',
      data: [],
      error: error.message
    });
  }
};

module.exports = {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent
};
