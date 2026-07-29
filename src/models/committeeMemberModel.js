const mongoose = require('mongoose');

const committeeMemberSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true
  },
  middle_name: {
    type: String
  },
  last_name: {
    type: String,
    required: true
  },
  number: {
    type: String,
    required: true,
    unique: true
  },
  image: {
    type: String
  },
  designation: {
    type: String,
    required: true
  },
  status: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

module.exports = mongoose.model('CommitteeMember', committeeMemberSchema);
