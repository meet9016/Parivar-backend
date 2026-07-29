const mongoose = require('mongoose');

const galleryCategorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    index: true,
    trim: true,
    minlength: 1
  },

}, {
  timestamps: true,
  strict: false
});


module.exports = mongoose.model('GalleryCategory', galleryCategorySchema);
