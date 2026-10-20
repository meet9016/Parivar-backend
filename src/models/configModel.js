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
  playStoreUrl: {
    type: String,
    default: "",
  },
  playstore_url: {
    type: String,
    default: "",
  },
  appStoreUrl: {
    type: String,
    default: "",
  },
  appstore_url: {
    type: String,
    default: "",
  },

  // Monday Scheduled Push Notification
  mondayPushEnabled: {
    type: Boolean,
    default: true,
  },
  mondayPushTime: {
    type: String,
    default: "09:00",
  },
  mondayPushKey: {
    type: String,
    default: "monday_weekly",
  },
  mondayPushTitle: {
    type: String,
    default: "",
  },
  mondayPushBody: {
    type: String,
    default: "",
  },
  lastMondayPushDate: {
    type: String,
    default: "",
  },

  // Friday Scheduled Push Notification (Auto 5:00 PM)
  fridayPushEnabled: {
    type: Boolean,
    default: true,
  },
  fridayPushKey: {
    type: String,
    default: "jummah_mubarak",
  },
  fridayPushTime: {
    type: String,
    default: "10:00",
  },
  fridayPushTitle: {
    type: String,
    default: "",
  },
  fridayPushBody: {
    type: String,
    default: "",
  },
  lastFridayPushDate: {
    type: String,
    default: "",
  },

  // Dynamic Prayer / Namaz Timetable Configuration
  prayerTimes: {
    enabled: {
      type: Boolean,
      default: true,
    },
    showOnWebsite: {
      type: Boolean,
      default: true,
    },
    title: {
      type: String,
      default: 'રાધનપુર મેમણ જમાત',
    },
    subTitle: {
      type: String,
      default: 'રાધનપુર',
    },
    logo: {
      type: String,
      default: '',
    },
    fajr: {
      name: { type: String, default: 'ફજર' },
      azan: { type: String, default: '05:26' },
      jamat: { type: String, default: '05:45' },
      qaza: { type: String, default: '06:42' },
      qazaLabel: { type: String, default: 'સુધી' },
    },
    zohr: {
      name: { type: String, default: 'ઝોહર' },
      azan: { type: String, default: '12:28' },
      jamat: { type: String, default: '12:45' },
      qaza: { type: String, default: '04:36' },
      qazaLabel: { type: String, default: 'સુધી' },
    },
    asr: {
      name: { type: String, default: 'અસર' },
      azan: { type: String, default: '04:36' },
      jamat: { type: String, default: '04:50' },
      qaza: { type: String, default: '06:16' },
      qazaLabel: { type: String, default: 'સુધી' },
    },
    maghrib: {
      name: { type: String, default: 'મગરીબ' },
      azan: { type: String, default: '06:16' },
      jamat: { type: String, default: '06:18' },
      qaza: { type: String, default: '07:29' },
      qazaLabel: { type: String, default: 'સુધી' },
    },
    isha: {
      name: { type: String, default: 'ઈશા' },
      azan: { type: String, default: '07:29' },
      jamat: { type: String, default: '07:45' },
      qaza: { type: String, default: '05:25' },
      qazaLabel: { type: String, default: 'સુધી' },
    },
    tahajjudEnd: {
      type: String,
      default: '05:25',
    },
    sehriEnd: {
      type: String,
      default: '05:25',
    },
    sunrise: {
      type: String,
      default: '06:42',
    },
    ishraq: {
      type: String,
      default: '06:57',
    },
    chasht: {
      type: String,
      default: '08:30',
    },
    iftar: {
      type: String,
      default: '06:16',
    },
    note: {
      type: String,
      default: '',
    },
    azanOffsetMinutes: {
      type: Number,
      default: 25,
    },
    jamatOffsetMinutes: {
      type: Number,
      default: 15,
    },
    qazaOffsetMinutes: {
      type: Number,
      default: 15,
    },
  },

  // Tracks prayer push notification keys sent per date to prevent duplicates
  prayerAlertsSent: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
}, {
  timestamps: true,
  strict: false,
  id: false
});

module.exports = createTenantProxy('Config', configSchema);