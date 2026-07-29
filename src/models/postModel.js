const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  member_id: {
    type: String,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },


  description: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: ''
  },
  status: {
    type: Number,
    default: 1,
    index: true
  },
  cdate: {
    type: String,
    default: ''
  },
  // Tenancy/ownership fields
  country_id: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  state_id: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  city_id: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
created_by: {
  id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  name: { type: String, default: '' }
},


}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Post', postSchema);
