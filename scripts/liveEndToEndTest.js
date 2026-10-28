require('dotenv').config();
const mongoose = require('mongoose');
const Config = require('../src/models/configModel');
const Notification = require('../src/models/notificationModel');
const { checkAndSendScheduledNotifications } = require('../src/services/scheduledNotificationService');

async function liveTest() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('--- LIVE END-TO-END TEST START ---');

  const now = new Date();
  const kolkataFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });
  const parts = kolkataFormatter.formatToParts(now);
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  let currentHour = parseInt(partMap.hour, 10);
  if (currentHour === 24) currentHour = 0;
  const currentMinute = parseInt(partMap.minute, 10);

  // Set prayer time to (now + 2 minutes)
  const targetMinute = (currentMinute + 2) % 60;
  const targetHour = currentMinute + 2 >= 60 ? (currentHour + 1) % 24 : currentHour;
  const period = targetHour >= 12 ? 'PM' : 'AM';
  const displayHour = targetHour % 12 === 0 ? 12 : targetHour % 12;
  const testPrayerTime = `${String(displayHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')} ${period}`;

  console.log(`Current IST Time: ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`);
  console.log(`Setting Asr Azan time to: ${testPrayerTime} with 2 minutes advance reminder...`);
  console.log(`Expected Trigger Time: EXACTLY NOW at ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}!`);

  const cfg = await Config.findOne();
  const originalPt = JSON.parse(JSON.stringify(cfg.prayerTimes));

  // Update Config with test Asr time and 2 min offset
  const updatedPt = {
    ...originalPt,
    enabled: true,
    notificationsEnabled: true,
    notifications_enabled: true,
    azanOffsetMinutes: 2,
    asr: {
      ...originalPt.asr,
      azan: testPrayerTime
    }
  };

  cfg.prayerTimes = updatedPt;
  cfg.markModified('prayerTimes');
  await cfg.save();

  // Run the scheduler!
  console.log('\nRunning checkAndSendScheduledNotifications()...');
  await checkAndSendScheduledNotifications();

  // Wait 3 seconds for background FCM and DB writes
  await new Promise(r => setTimeout(r, 3000));

  // Check if notification was created in DB
  const latestNotif = await Notification.findOne({
    type: 'prayer_reminder',
    prayer: 'asr',
    prayer_type: 'azan'
  }).sort({ createdAt: -1 }).lean();

  if (latestNotif) {
    console.log('\n✅ NOTIFICATION VERIFIED IN DATABASE:');
    console.log('ID:', latestNotif._id);
    console.log('Title:', latestNotif.title);
    console.log('Body:', latestNotif.body);
    console.log('Prayer Time:', latestNotif.prayer_time);
    console.log('Lead Minutes:', latestNotif.lead_minutes);
    console.log('Created At:', latestNotif.createdAt);
  } else {
    console.error('❌ NOTIFICATION NOT FOUND IN DATABASE');
  }

  // Restore original config
  cfg.prayerTimes = originalPt;
  cfg.markModified('prayerTimes');
  await cfg.save();
  console.log('\nOriginal config restored.');

  console.log('--- LIVE END-TO-END TEST FINISHED ---');
  await mongoose.disconnect();
}

liveTest();

