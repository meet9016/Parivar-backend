const Config = require('../models/configModel');
const { getRegistryConnection } = require('../config/registryDb');
const tenantSchema = require('../models/tenantSchema');
const { publicUrl } = require('../utils/apiResponse');

const formatConfig = (req, config) => {
  if (!config) return null;
  const obj = config.toObject ? config.toObject() : { ...config };

  if (obj.appLogo) obj.appLogo = publicUrl(req, obj.appLogo);
  if (obj.webLogo) obj.webLogo = publicUrl(req, obj.webLogo);
  if (obj.favicon) obj.favicon = publicUrl(req, obj.favicon);

  if (Array.isArray(obj.bannerImages)) {
    obj.bannerImages = obj.bannerImages
      .filter(Boolean)
      .map(url => publicUrl(req, url));
  } else if (obj.bannerImages) {
    obj.bannerImages = [publicUrl(req, obj.bannerImages)];
  } else {
    obj.bannerImages = [];
  }

  return obj;
};

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
      } catch (err) {
        console.error('[getConfig] Error looking up tenant from registry:', err.message);
      }
    }

    const expectedName = tenantRecord && tenantRecord.parivar_name
      ? (tenantRecord.community_type === 'Village' || tenantRecord.parivar_name.toLowerCase().includes('parivar')
          ? tenantRecord.parivar_name
          : `${tenantRecord.parivar_name} Parivar`)
      : (tenantSlug ? `${tenantSlug.charAt(0).toUpperCase() + tenantSlug.slice(1)} Parivar` : 'Parivar');

    if (!config) {
      const newConfig = new Config({ name: expectedName });
      await newConfig.save();
      config = newConfig;
    } else if (tenantRecord && tenantRecord.parivar_name) {
      // If name is default 'Parivar' or contains wrong surname from template/clone
      if (!config.name || config.name === 'Parivar' || !config.name.toLowerCase().includes(tenantRecord.parivar_name.toLowerCase())) {
        config.name = expectedName;
        await config.save();
      }
    }

    console.log('[getConfig] Final config sending:', config);
    res.status(200).json({
      message: 'Configuration retrieved successfully',
      data: formatConfig(req, config)
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

    if (req.body.bannerImages !== undefined) {
      config.bannerImages = Array.isArray(req.body.bannerImages)
        ? req.body.bannerImages
        : (req.body.bannerImages ? [req.body.bannerImages] : []);
      config.markModified('bannerImages');
    }

    await config.save();
    res.status(200).json({
      message: 'Configuration updated successfully',
      data: formatConfig(req, config)
    });
  } catch (error) {
    console.error('[updateConfig] error:', error);
    res.status(500).json({ message: 'Error updating configuration', error: error.message });
  }
};

module.exports = {
  getConfig,
  updateConfig
};

