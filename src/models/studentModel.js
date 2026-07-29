const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  surname: {
    type: String,
    required: true,
    trim: true
  },
  student_name: {
    type: String,
    required: true,
    trim: true
  },
  father_name: {
    type: String,
    required: true,
    trim: true
  },
  school_name: {
    type: String,
    required: true,
    trim: true
  },
  standard: {
    type: String,
    required: true,
    trim: true
  },
  percentage: {
    type: String,
    required: true,
    trim: true
  },
  mobile_number: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: String,
    default: '',
  },
  result_image: {
    type: String,
    default: '',
    required: true
  },
  student_image: {
    type: String,
    default: '',
    required: true

  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: Number,
    default: 0,
    index: true
  },
  cdate: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Student', studentSchema);
