const mongoose = require('mongoose');
const { ALL_PERMISSION_KEYS } = require('../config/permissions');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true
  },

  permissions: {
    type: [String],
    default: [],
    validate: {
      validator: (values) => values.every((value) => ALL_PERMISSION_KEYS.includes(value)),
      message: 'Role contains an invalid permission'
    }
  },
  status: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  strict: false
});


module.exports = mongoose.model('Role', roleSchema);
