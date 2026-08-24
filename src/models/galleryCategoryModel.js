const mongoose = require('mongoose');

const galleryCategorySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.Mixed,
    default: () => new mongoose.Types.ObjectId()
  },
  category: {
    type: String,
    required: true,
    index: true,
    trim: true,
    minlength: 1
  },

}, {
  timestamps: true,
  strict: false, id: false
});


module.exports = mongoose.model('GalleryCategory', galleryCategorySchema);
