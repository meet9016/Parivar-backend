const Version = require('../models/versionModel');

/**
 * Get current App Version details.
 * If none exists in DB, automatically initializes with default values.
 */
const getVersion = async (req, res) => {
  try {
    let version = await Version.findOne().sort({ createdAt: -1 });

    if (!version) {
      version = await Version.create({
        android_version_code: '1.0.6(1)',
        ios_version_code: '1.0.4(1)',
        android_version_type: 'force',
        ios_version_type: 'optional',
        play_store_link: 'https://play.google.com/store/apps/details?id=com.radhanpur.memon.jamat&hl=en_IN',
        app_store_link: 'https://apps.apple.com/in/app/chovatiya-parivar-family-app/id6808123832'
      });
    }

    if (req.query.raw === 'true' || req.query.format === 'raw') {
      return res.status(200).json(version);
    }

    return res.status(200).json({
      status: 200,
      message: 'App version details retrieved successfully',
      data: version
    });
  } catch (error) {
    console.error('[getVersion error]:', error);
    return res.status(500).json({
      status: 500,
      message: 'Error retrieving app version details',
      data: null,
      error: error.message
    });
  }
};

module.exports = {
  getVersion
};
