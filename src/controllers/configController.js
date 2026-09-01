const Config = require('../models/configModel');
const { getRegistryConnection } = require('../config/registryDb');
const tenantSchema = require('../models/tenantSchema');

// Get configuration, create default if none exists
const getConfig = async (req, res) => {
  try {
    const tenantSlug = req.headers['x-tenant-id']?.toLowerCase();
    console.log('[getConfig] tenantSlug header:', tenantSlug, 'req.tenantConn:', !!req.tenantConn);
    
    let config = await Config.findOne();
    console.log('[getConfig] Config.findOne() result:', config);

    // Check if a tenant header is provided to resolve community name
    let tenantRecord = null;
    if (tenantSlug) {
      try {
        const registryConn = await getRegistryConnection();
        const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', tenantSchema);
        tenantRecord = await Tenant.findOne({ slug: tenantSlug });
        console.log('[getConfig] tenantRecord found:', tenantRecord?.parivar_name);
      } catch (err) {
        console.error('[getConfig] Error looking up tenant from registry:', err.message);
      }
    }

    if (!config) {
      let defaultName = 'Parivar';
      if (tenantRecord && tenantRecord.parivar_name) {
        defaultName =
          tenantRecord.community_type === 'Village' ||
          tenantRecord.parivar_name.toLowerCase().includes('parivar')
            ? tenantRecord.parivar_name
            : `${tenantRecord.parivar_name} Parivar`;
      }
      console.log('[getConfig] Creating new config with defaultName:', defaultName);
      const newConfig = new Config({ name: defaultName });
      await newConfig.save();
      config = newConfig;
    } else if (tenantRecord && tenantRecord.parivar_name) {
      if (!config.name || config.name === 'Parivar') {
        config.name =
          tenantRecord.community_type === 'Village' ||
          tenantRecord.parivar_name.toLowerCase().includes('parivar')
            ? tenantRecord.parivar_name
            : `${tenantRecord.parivar_name} Parivar`;
        await config.save();
      }
    }

    console.log('[getConfig] Final config sending:', config);
    res.status(200).json({
      message: 'Configuration retrieved successfully',
      data: config
    });
  } catch (error) {
    console.error('[getConfig] Catch error:', error);
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

