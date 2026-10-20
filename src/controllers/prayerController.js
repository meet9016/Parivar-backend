const Config = require('../models/configModel');
const { formatConfig, DEFAULT_PRAYER_TIMES } = require('./configController');

/**
 * Get prayer times configuration (Public endpoint)
 */
const getPrayerTimes = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      return res.status(200).json({
        success: true,
        data: DEFAULT_PRAYER_TIMES
      });
    }

    const formatted = formatConfig(req, config);
    return res.status(200).json({
      success: true,
      data: formatted.prayerTimes || DEFAULT_PRAYER_TIMES
    });
  } catch (error) {
    console.error('[getPrayerTimes error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve prayer times',
      error: error.message
    });
  }
};

/**
 * Update prayer times configuration (Protected endpoint)
 */
const updatePrayerTimes = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = new Config({});
    }

    let pt = req.body.prayerTimes || req.body;
    if (typeof pt === 'string') {
      try {
        pt = JSON.parse(pt);
      } catch (e) {
        pt = {};
      }
    }

    if (req.body.prayerLogo) {
      pt.logo = req.body.prayerLogo;
    }

    config.prayerTimes = {
      ...(config.prayerTimes || {}),
      ...pt
    };
    config.markModified('prayerTimes');

    await config.save();
    const formatted = formatConfig(req, config);

    return res.status(200).json({
      success: true,
      message: 'Prayer timetable updated successfully',
      data: formatted.prayerTimes
    });
  } catch (error) {
    console.error('[updatePrayerTimes error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update prayer times',
      error: error.message
    });
  }
};

module.exports = {
  getPrayerTimes,
  updatePrayerTimes
};
