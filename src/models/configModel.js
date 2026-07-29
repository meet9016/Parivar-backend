const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  primaryColor: {
    type: String,
    default: "#E65100"
  },
  secondaryColor: {
    type: String,
    default: "#F4C95D"
  },
  backgroundColor: {
    type: String,
    default: "#FFF8F0"
  },
  textColor: {
    type: String,
    default: "#4E342E"
  },
  buttonColor: {
    type: String,
    default: "#E65100"
  },
  fontColor: {
    type: String,
    default: "#FFFFFF"
  },
  borderColor: {
    type: String,
    default: "#E8D9C8"
  },
  gradientStart: {
    type: String,
    default: "#E65100"
  },
  gradientEnd: {
    type: String,
    default: "#7B0D1C"
  },

  appLogo: {
    type: String,
    default: ""
  },
  webLogo: {
    type: String,
    default: ""
  },
  favicon: {
    type: String,
    default: ""
  },

  name: {
    type: String,
    default: "Parivar",
  },
  bannerImages: {
    type: [String],
    default: [],
  },
  email: {
    type: String,
    default: "",
  },
  phone: {
    type: String,
    default: "",
  },
  facebook: {
    type: String,
    default: "",
  },
  twitter: {
    type: String,
    default: "",
  },
  instagram: {
    type: String,
    default: "",
  },
  youtube: {
    type: String,
    default: "",
  },
  whatsapp: {
    type: String,
    default: "",
  },

  


}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Config', configSchema);