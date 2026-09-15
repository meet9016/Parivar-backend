const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  primaryColor: {
    type: String,
    default: "#1565C0"
  },
  secondaryColor: {
    type: String,
    default: "#42A5F5"
  },
  backgroundColor: {
    type: String,
    default: "#F7FAFD"
  },
  textColor: {
    type: String,
    default: "#172B4D"
  },
  buttonColor: {
    type: String,
    default: "#1976D2"
  },
  fontColor: {
    type: String,
    default: "#FFFFFF"
  },
  borderColor: {
    type: String,
    default: "#D9E7F5"
  },
  gradientStart: {
    type: String,
    default: "#2196F3"
  },
  gradientEnd: {
    type: String,
    default: "#0D47A1"
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
  strict: false, id: false
});

module.exports = createTenantProxy('Config', configSchema);