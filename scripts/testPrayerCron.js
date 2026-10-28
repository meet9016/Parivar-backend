require('dotenv').config();
const mongoose = require('mongoose');
const Config = require('../src/models/configModel');
const { createAndBroadcast } = require('../src/controllers/notificationController');
const { checkAndSendScheduledNotifications } = require('../src/services/scheduledNotificationService');

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/parivar';
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);

  const config = await Config.findOne();
  if (!config) {
    console.error('No configuration document found in DB.');
    process.exit(1);
  }

  const pt = config.prayerTimes || {};
  const prayers = [
    { key: 'fajr', name: 'ફજર (Fajr)', defaultAzan: '05:26', defaultJamat: '05:40', defaultQaza: '06:42', period: 'AM', qazaPeriod: 'AM' },
    { key: 'zohr', name: 'ઝોહર (Zohr)', defaultAzan: '12:28', defaultJamat: '12:45', defaultQaza: '04:36', period: 'PM', qazaPeriod: 'PM' },
    { key: 'asr', name: 'અસર (Asr)', defaultAzan: '04:36', defaultJamat: '04:50', defaultQaza: '06:16', period: 'PM', qazaPeriod: 'PM' },
    { key: 'maghrib', name: 'મગરીબ (Maghrib)', defaultAzan: '06:16', defaultJamat: '06:18', defaultQaza: '07:29', period: 'PM', qazaPeriod: 'PM' },
    { key: 'isha', name: 'ઈશા (Isha)', defaultAzan: '07:29', defaultJamat: '07:45', defaultQaza: '05:25', period: 'PM', qazaPeriod: 'AM' }
  ];

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
  const parts = kolkataFormatter.formatToParts(new Date());
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  let currentHour = parseInt(partMap.hour, 10);
  if (currentHour === 24) currentHour = 0;
  const currentMinute = parseInt(partMap.minute, 10);
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  const todayDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;

  const parsePrayerTimeToMinutes = (timeStr, defaultPeriod) => {
    if (!timeStr) return null;
    const trimmed = String(timeStr).replace(/[\u00A0\s]+/g, ' ').trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{1,2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    let p = match[3]?.toUpperCase();
    if (!p) {
      if (h < 12) p = defaultPeriod;
      else p = 'PM';
    }
    if (p === 'PM' && h < 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const formatMinutesToTime = (totalMinutes) => {
    if (totalMinutes === null || isNaN(totalMinutes)) return 'N/A';
    let mins = (totalMinutes + 1440) % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period} (${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')})`;
  };

  console.log('\n========================================================================');
  console.log(`🕌 NAMAZ TIMETABLE CRON SCHEDULE CHECK (Current Time: ${currentTimeStr} IST | Date: ${todayDateStr})`);
  console.log(`Push Notifications Enabled: ${pt.notificationsEnabled !== false}`);
  console.log('========================================================================');

  const azanOffset = Number.isInteger(parseInt(pt.azanOffsetMinutes, 10)) ? parseInt(pt.azanOffsetMinutes, 10) : 25;
  const jamatOffset = Number.isInteger(parseInt(pt.jamatOffsetMinutes, 10)) ? parseInt(pt.jamatOffsetMinutes, 10) : 15;
  const qazaOffset = Number.isInteger(parseInt(pt.qazaOffsetMinutes, 10)) ? parseInt(pt.qazaOffsetMinutes, 10) : 15;

  const tableData = [];
  for (const prayer of prayers) {
    const pData = pt[prayer.key] || {};
    const azanRaw = pData.azan || prayer.defaultAzan;
    const jamatRaw = pData.jamat || prayer.defaultJamat;
    const qazaRaw = pData.qaza || prayer.defaultQaza;

    const azanMin = parsePrayerTimeToMinutes(azanRaw, prayer.period);
    const jamatMin = parsePrayerTimeToMinutes(jamatRaw, prayer.period);
    const qazaMin = parsePrayerTimeToMinutes(qazaRaw, prayer.qazaPeriod || prayer.period);

    const azanTriggerMin = azanMin !== null ? (azanMin - azanOffset + 1440) % 1440 : null;
    const jamatTriggerMin = jamatMin !== null ? (jamatMin - jamatOffset + 1440) % 1440 : null;
    const qazaTriggerMin = qazaMin !== null ? (qazaMin - qazaOffset + 1440) % 1440 : null;

    tableData.push({
      Prayer: prayer.name,
      'Azan Time': azanRaw,
      [`Azan Alert (-${azanOffset}m)`]: formatMinutesToTime(azanTriggerMin),
      'Azan Key': `${prayer.key}_azan_${azanRaw}_${azanOffset}m`,
      'Jamat Time': jamatRaw,
      [`Jamat Alert (-${jamatOffset}m)`]: formatMinutesToTime(jamatTriggerMin),
      'Jamat Key': `${prayer.key}_jamat_${jamatRaw}_${jamatOffset}m`,
      'Qaza Until': qazaRaw,
      [`Qaza Alert (-${qazaOffset}m)`]: formatMinutesToTime(qazaTriggerMin),
      'Qaza Key': `${prayer.key}_qaza_${qazaRaw}_${qazaOffset}m`
    });
  }

  console.table(tableData);

  // Check if args requested immediate test trigger or scheduler check
  const args = process.argv.slice(2);
  if (args[0] === 'cron' || args[0] === 'check') {
    console.log('\n⏳ Running checkAndSendScheduledNotifications()...');
    await checkAndSendScheduledNotifications();
    console.log('✅ Cron execution completed.');
  } else if (args.length > 0) {
    const prayerArg = (args[0] || 'fajr').toLowerCase();
    const typeArg = (args[1] || 'azan').toLowerCase(); // 'azan', 'jamat', or 'qaza'

    const targetPrayer = prayers.find(p => p.key === prayerArg) || prayers[0];
    const pData = pt[targetPrayer.key] || {};
    const pName = pData.name || targetPrayer.name;
    let pTime = '05:26';
    let leadMin = 25;
    let title = '';
    let body = '';

    if (typeArg === 'azan') {
      pTime = pData.azan || targetPrayer.defaultAzan;
      leadMin = azanOffset;
      title = leadMin === 0 ? `${pName} અઝાનનો સમય થયો છે` : `${pName} અઝાન સમય - ${leadMin} મિનિટ બાકી`;
      body = leadMin === 0 ? `${pName} નમાઝની અઝાનનો સમય ${pTime} થયો છે.` : `${pName} નમાઝની અઝાનનો સમય ${pTime} છે. (${leadMin} મિનિટ બાકી)`;
    } else if (typeArg === 'jamat') {
      pTime = pData.jamat || targetPrayer.defaultJamat;
      leadMin = jamatOffset;
      title = leadMin === 0 ? `${pName} જમાતનો સમય થયો છે` : `${pName} જમાત સમય - ${leadMin} મિનિટ બાકી`;
      body = leadMin === 0 ? `${pName} નમાઝની જમાતનો સમય ${pTime} થયો છે.` : `${pName} નમાઝની જમાતનો સમય ${pTime} છે. (${leadMin} મિનિટ બાકી)`;
    } else {
      pTime = pData.qaza || targetPrayer.defaultQaza;
      leadMin = qazaOffset;
      title = leadMin === 0 ? `${pName} નમાઝ કઝા થઈ ગઈ છે` : `${pName} કઝા સમય - ${leadMin} મિનિટ બાકી`;
      body = leadMin === 0 ? `${pName} નમાઝનો સમય સમાપ્ત થયો છે (કઝા સમય: ${pTime}).` : `${pName} નમાઝ કઝા થવામાં ${leadMin} મિનિટ બાકી છે (કઝા સમય: ${pTime}). જલદી નમાઝ અદા કરી લો.`;
    }

    const alertKey = `${targetPrayer.key}_${typeArg}`;

    console.log(`\n🚀 Triggering TEST Notification for [${alertKey}]...`);

    await createAndBroadcast({
      title,
      body,
      type: 'prayer_reminder',
      target_type: 'all',
      target_users: [],
      date: new Date(),
      key: alertKey,
      push_key: alertKey,
      prayer_key: alertKey,
      prayer: targetPrayer.key,
      prayer_name: pName,
      prayer_type: typeArg,
      prayer_time: pTime,
      lead_minutes: leadMin,
      is_test: true
    });

    console.log(`✅ Test Notification Sent Successfully!`);
    console.log(`   Key: ${alertKey}`);
    console.log(`   Title: ${title}`);
    console.log(`   Body: ${body}`);
  } else {
    console.log('\n💡 Hint: To test trigger a specific prayer key, run:');
    console.log('   node scripts/testPrayerCron.js fajr azan');
    console.log('   node scripts/testPrayerCron.js asr azan');
    console.log('   node scripts/testPrayerCron.js check');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
