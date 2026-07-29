const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  member_id: {
    type: String,
    required: true,
    index: true
  },
  business_name: {
    type: String,
    required: true,
    trim: true
  },
  business_category_id: {
    type: String,
    required: true,
    index: true
  },
  number: {
    type: String,
    required: true,
    trim: true
  },
  whatsapp_number: {
    type: String,
    default: '',
    trim: true
  },
  GST_number: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  country_id: {
    type: String,
    required: true
  },
  state_id: {
    type: String,
    required: true
  },
  city_id: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  location_link: {
    type: String,
    default: '',
    trim: true
  },
  
  about_us: {
    type: String,
    default: '',
    trim: true
  },
  facebook: {
    type: String,
    default: '',
    trim: true
  },
  instagram: {
    type: String,
    default: '',
    trim: true
  },
  pinterest: {
    type: String,
    default: '',
    trim: true
  },
  youtube: {
    type: String,
    default: '',
    trim: true
  },
  website: {
    type: String,
    default: '',
    trim: true
  },
  image: {
    type: String, 
    default: ''
  },
  gallery_images: {
    type: [String], 
    default: []
  },
  status: {
    type: Number,
    default: 0,
    index: true
  },

}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Business', businessSchema);
