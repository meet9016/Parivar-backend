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

  const playLink = obj.playStoreUrl || obj.playstore_url || obj.android_app_link || '';
  const appLink = obj.appStoreUrl || obj.appstore_url || obj.ios_app_link || '';

  obj.playStoreUrl = playLink;
  obj.playstore_url = playLink;
  obj.android_app_link = playLink;
  obj.appStoreUrl = appLink;
  obj.appstore_url = appLink;
  obj.ios_app_link = appLink;

  // Monday scheduled push settings
  obj.mondayPushEnabled = obj.mondayPushEnabled !== false;
  obj.mondayPushTime = obj.mondayPushTime || '09:00';
  obj.mondayPushKey = obj.mondayPushKey || 'monday_weekly';
  obj.mondayPushTitle = obj.mondayPushTitle || '';
  obj.mondayPushBody = obj.mondayPushBody || '';
  obj.monday_push_time = obj.mondayPushTime;
  obj.monday_push_key = obj.mondayPushKey;
  obj.monday_push_enabled = obj.mondayPushEnabled;

  // Friday scheduled push settings (auto 10:00 AM)
  obj.fridayPushEnabled = obj.fridayPushEnabled !== false;
  obj.fridayPushKey = obj.fridayPushKey || 'jummah_mubarak';
  obj.fridayPushTime = obj.fridayPushTime || '10:00';
  obj.fridayPushTitle = obj.fridayPushTitle || '';
  obj.fridayPushBody = obj.fridayPushBody || '';
  obj.friday_push_key = obj.fridayPushKey;
  obj.friday_push_time = obj.fridayPushTime;
  obj.friday_push_enabled = obj.fridayPushEnabled;

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

    const playLink = req.body.playStoreUrl !== undefined ? req.body.playStoreUrl : req.body.playstore_url;
    if (playLink !== undefined) {
      config.playStoreUrl = playLink;
      config.playstore_url = playLink;
    }
    const appLink = req.body.appStoreUrl !== undefined ? req.body.appStoreUrl : req.body.appstore_url;
    if (appLink !== undefined) {
      config.appStoreUrl = appLink;
      config.appstore_url = appLink;
    }

    // Monday Settings
    const mTime = req.body.mondayPushTime !== undefined ? req.body.mondayPushTime : req.body.monday_push_time;
    if (mTime !== undefined) config.mondayPushTime = mTime;
    const mKey = req.body.mondayPushKey !== undefined ? req.body.mondayPushKey : req.body.monday_push_key;
    if (mKey !== undefined) config.mondayPushKey = mKey;
    const mTitle = req.body.mondayPushTitle !== undefined ? req.body.mondayPushTitle : req.body.monday_push_title;
    if (mTitle !== undefined) config.mondayPushTitle = mTitle;
    const mBody = req.body.mondayPushBody !== undefined ? req.body.mondayPushBody : req.body.monday_push_body;
    if (mBody !== undefined) config.mondayPushBody = mBody;
    const mEnabled = req.body.mondayPushEnabled !== undefined ? req.body.mondayPushEnabled : req.body.monday_push_enabled;
    if (mEnabled !== undefined) {
      config.mondayPushEnabled = mEnabled === true || mEnabled === 'true' || mEnabled === 1 || mEnabled === '1';
    }

    // Friday Settings
    const fKey = req.body.fridayPushKey !== undefined ? req.body.fridayPushKey : req.body.friday_push_key;
    if (fKey !== undefined) config.fridayPushKey = fKey;
    const fTime = req.body.fridayPushTime !== undefined ? req.body.fridayPushTime : req.body.friday_push_time;
    if (fTime !== undefined) config.fridayPushTime = fTime;
    const fTitle = req.body.fridayPushTitle !== undefined ? req.body.fridayPushTitle : req.body.friday_push_title;
    if (fTitle !== undefined) config.fridayPushTitle = fTitle;
    const fBody = req.body.fridayPushBody !== undefined ? req.body.fridayPushBody : req.body.friday_push_body;
    if (fBody !== undefined) config.fridayPushBody = fBody;
    const fEnabled = req.body.fridayPushEnabled !== undefined ? req.body.fridayPushEnabled : req.body.friday_push_enabled;
    if (fEnabled !== undefined) {
      config.fridayPushEnabled = fEnabled === true || fEnabled === 'true' || fEnabled === 1 || fEnabled === '1';
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

// Immediate test push notification for Monday or Friday
const testScheduledPush = async (req, res) => {
  try {
    const { day } = req.body; // 'monday' or 'friday'
    const config = await Config.findOne();
    const { createAndBroadcast } = require('./notificationController');
    const now = new Date();

    if (day === 'friday') {
      const fridayKey = (config?.fridayPushKey || 'jummah_mubarak').trim();
      await createAndBroadcast({
        title: config?.fridayPushTitle || `${config?.name || 'Parivar'} - શુક્રવાર સંદેશ`,
        body: config?.fridayPushBody || `આપ સૌને શુક્રવાર મુબારક! અઠવાડિયાની વિશેષ માહિતી અને અપડેટ્સ તપાસો.`,
        type: 'weekly_friday',
        target_type: 'all',
        target_users: [],
        date: now,
        key: fridayKey,
        friday_key: fridayKey,
        friday_push_key: fridayKey,
        push_key: fridayKey
      });
      return res.status(200).json({
        message: `Friday test push notification sent successfully (Key: ${fridayKey})`,
        key: fridayKey
      });
    } else {
      // Default to Monday
      const mondayTime = config?.mondayPushTime || '09:00';
      const mondayKey = config?.mondayPushKey || 'monday_weekly';
      await createAndBroadcast({
        title: config?.mondayPushTitle || `${config?.name || 'Parivar'} - સાપ્તાહિક અપડેટ`,
        body: config?.mondayPushBody || `નવા અઠવાડિયાની શુભકામનાઓ! સમુદાયની નવીનતમ માહિતી અને ગતિવિધિઓ જુઓ.`,
        type: 'weekly_monday',
        target_type: 'all',
        target_users: [],
        date: now,
        key: mondayKey,
        monday_key: mondayKey,
        monday_time: mondayTime
      });
      return res.status(200).json({
        message: `Monday test push notification sent successfully (Time: ${mondayTime}, Key: ${mondayKey})`,
        monday_time: mondayTime,
        key: mondayKey
      });
    }
  } catch (err) {
    console.error('[testScheduledPush error]:', err);
    res.status(500).json({ message: 'Error sending test push', error: err.message });
  }
};

module.exports = {
  getConfig,
  updateConfig,
  testScheduledPush
};

