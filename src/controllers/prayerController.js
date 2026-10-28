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

    if (pt.notificationsEnabled !== undefined || pt.notifications_enabled !== undefined) {
      const val = pt.notificationsEnabled !== undefined ? pt.notificationsEnabled : pt.notifications_enabled;
      const isFalsyVal = (v) => v === false || v === 'false' || v === 0 || v === '0';
      const isEnabled = !isFalsyVal(val);
      pt.notificationsEnabled = isEnabled;
      pt.notifications_enabled = isEnabled;
    }

    config.prayerTimes = {
      ...(config.prayerTimes ? (config.prayerTimes.toObject ? config.prayerTimes.toObject() : config.prayerTimes) : {}),
      ...pt
    };
    if (pt.notificationsEnabled !== undefined) {
      config.prayerTimes.notificationsEnabled = pt.notificationsEnabled;
      config.prayerTimes.notifications_enabled = pt.notifications_enabled;
    }
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
