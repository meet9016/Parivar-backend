const mongoose = require('mongoose');
const { createTenantProxy } = require('../utils/tenantContext');

const versionSchema = new mongoose.Schema({
  android_version_code: {
    type: String,
    default: '1.0.6(1)',
    trim: true
  },
  ios_version_code: {
    type: String,
    default: '1.0.4(1)',
    trim: true
  },
  android_version_type: {
    type: String,
    enum: ['force', 'optional'],
    default: 'force'
  },
  ios_version_type: {
    type: String,
    enum: ['force', 'optional'],
    default: 'optional'
  },
  play_store_link: {
    type: String,
    default: 'https://play.google.com/store/apps/details?id=com.radhanpur.memon.jamat&hl=en_IN',
    trim: true
  },
  app_store_link: {
    type: String,
    default: 'https://apps.apple.com/in/app/chovatiya-parivar-family-app/id6808123832',
    trim: true
  }
}, {
  timestamps: true,
  strict: false,
  collection: 'versions'
});

module.exports = createTenantProxy('Version', versionSchema);
