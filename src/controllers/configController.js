const Config = require('../models/configModel');
const { getRegistryConnection } = require('../config/registryDb');
const tenantSchema = require('../models/tenantSchema');
const { publicUrl } = require('../utils/apiResponse');

// Helper to convert any time string into 12-hour format with explicit AM/PM (e.g. "00:00" -> "12:00 AM", "12:00" -> "12:00 PM")
const formatTimeTo12Hour = (timeStr) => {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();
  if (/am|pm/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12; // 00:00 becomes 12:00 AM
  return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
};

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

  // Monday & Friday scheduled push settings - ONLY 3 keys kept
  obj.mondayPushTime = formatTimeTo12Hour(obj.mondayPushTime || '09:00 AM');
  obj.fridayPushKey = (obj.fridayPushKey || 'jummah_mubarak').trim();
  obj.fridayPushTime = formatTimeTo12Hour(obj.fridayPushTime || '10:00 AM');

  // Strip all extra Monday and Friday keys
  delete obj.mondayPushEnabled;
  delete obj.mondayPushKey;
  delete obj.mondayPushTitle;
  delete obj.mondayPushBody;
  delete obj.monday_push_time;
  delete obj.monday_push_key;
  delete obj.monday_push_enabled;
  delete obj.lastMondayPushDate;

  delete obj.fridayPushEnabled;
  delete obj.fridayPushTitle;
  delete obj.fridayPushBody;
  delete obj.friday_push_key;
  delete obj.friday_push_time;
  delete obj.friday_push_enabled;
  delete obj.lastFridayPushDate;

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

    if (req.body.android_app_link !== undefined || req.body.playstore_url !== undefined) {
      const androidLink = req.body.android_app_link !== undefined ? req.body.android_app_link : req.body.playstore_url;
      config.android_app_link = androidLink;
      config.playstore_url = androidLink;
    }
    if (req.body.ios_app_link !== undefined || req.body.appstore_url !== undefined) {
      const iosLink = req.body.ios_app_link !== undefined ? req.body.ios_app_link : req.body.appstore_url;
      config.ios_app_link = iosLink;
      config.appstore_url = iosLink;
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

    // Monday Settings - ONLY mondayPushTime (saved formatted with AM/PM)
    const mTime = req.body.mondayPushTime !== undefined ? req.body.mondayPushTime : req.body.monday_push_time;
    if (mTime !== undefined && mTime !== null) {
      config.mondayPushTime = formatTimeTo12Hour(mTime);
    }

    // Friday Settings - ONLY fridayPushKey & fridayPushTime
    const fKey = req.body.fridayPushKey !== undefined ? req.body.fridayPushKey : req.body.friday_push_key;
    if (fKey !== undefined && fKey !== null) {
      config.fridayPushKey = String(fKey).trim() || 'jummah_mubarak';
    }
    const fTime = req.body.fridayPushTime !== undefined ? req.body.fridayPushTime : req.body.friday_push_time;
    if (fTime !== undefined && fTime !== null) {
      config.fridayPushTime = formatTimeTo12Hour(fTime);
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
      const fridayTime = formatTimeTo12Hour(config?.fridayPushTime || '10:00 AM');
      await createAndBroadcast({
        title: `${config?.name || 'Parivar'} - શુક્રવાર સંદેશ`,
        body: `આપ સૌને શુક્રવાર મુબારક! અઠવાડિયાની વિશેષ માહિતી અને અપડેટ્સ તપાસો.`,
        type: 'weekly_friday',
        target_type: 'all',
        target_users: [],
        date: now,
        key: fridayKey,
        friday_key: fridayKey,
        friday_push_key: fridayKey,
        push_key: fridayKey,
        friday_time: fridayTime
      });
      return res.status(200).json({
        message: `Friday test push notification sent successfully (Key: ${fridayKey}, Time: ${fridayTime})`,
        fridayPushKey: fridayKey,
        fridayPushTime: fridayTime
      });
    } else {
      // Default to Monday
      const mondayTime = formatTimeTo12Hour(config?.mondayPushTime || '09:00 AM');
      await createAndBroadcast({
        title: `${config?.name || 'Parivar'} - સાપ્તાહિક અપડેટ`,
        body: `નવા અઠવાડિયાની શુભકામનાઓ! સમુદાયની નવીનતમ માહિતી અને ગતિવિધિઓ જુઓ.`,
        type: 'weekly_monday',
        target_type: 'all',
        target_users: [],
        date: now,
        monday_time: mondayTime
      });
      return res.status(200).json({
        message: `Monday test push notification sent successfully (Time: ${mondayTime})`,
        mondayPushTime: mondayTime
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

