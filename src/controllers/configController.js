const Config = require('../models/configModel');

// Get configuration, create default if none exists
const getConfig = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = await Config.create();
    }
    res.status(200).json({
      message: 'Configuration retrieved successfully',
      data: config
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving configuration', error: error.message });
  }
};

// Update configuration (or create new if none exists)
const updateConfig = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = new Config({ ...req.body });
    } else {
      config.set({ ...req.body });
    }
    await config.save();
    res.status(200).json({
      message: 'Configuration updated successfully',
      data: config
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating configuration', error: error.message });
  }
};

module.exports = {
  getConfig,
  updateConfig
};
