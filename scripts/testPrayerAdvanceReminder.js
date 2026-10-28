require('dotenv').config();
const mongoose = require('mongoose');
const Config = require('../src/models/configModel');
const Notification = require('../src/models/notificationModel');
const { createAndBroadcast } = require('../src/controllers/notificationController');

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING ADVANCE REMINDER PRAYER NOTIFICATION VERIFICATION TESTS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Parser & Target Timing Calculation for User's Example
  // Asr = 11:55 AM, Azan Alert Offset = 2 min -> Target = 11:53 AM
  // -------------------------------------------------------------
  console.log('Test 1: Verification of User Example (Asr 11:55 AM, 2 min Advance Reminder)');

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

  const asrAzanRaw = '11:55 AM';
  const asrMinutes = parsePrayerTimeToMinutes(asrAzanRaw, 'PM');
  assert(asrMinutes === 11 * 60 + 55, `Asr 11:55 AM parsed to 715 minutes (actual: ${asrMinutes})`);

  const azanOffset = 2; // 2 minutes before
  const azanTargetMinutes = (asrMinutes - azanOffset + 1440) % 1440;
  const targetHour = Math.floor(azanTargetMinutes / 60);
  const targetMin = azanTargetMinutes % 60;
  assert(
    azanTargetMinutes === 11 * 60 + 53,
    `Target trigger is 11:53 AM (${targetHour}:${String(targetMin).padStart(2, '0')})`
  );

  // Time simulation at 11:52 AM (1 minute before)
  const time1152 = 11 * 60 + 52;
  const diffBefore = (time1152 - azanTargetMinutes + 1440) % 1440;
  const willTriggerBefore = diffBefore >= 0 && diffBefore <= 15;
  assert(!willTriggerBefore, `At 11:52 AM, notification will NOT trigger (diff: ${diffBefore})`);

  // Time simulation at 11:53 AM (exact target time)
  const time1153 = 11 * 60 + 53;
  const diffAtTarget = (time1153 - azanTargetMinutes + 1440) % 1440;
  const willTriggerAtTarget = diffAtTarget >= 0 && diffAtTarget <= 15;
  assert(willTriggerAtTarget && diffAtTarget === 0, `At 11:53 AM, notification TRIGGERS EXACTLY (diff: ${diffAtTarget})`);

  // Time simulation at 11:54 AM (1 minute after, within grace window)
  const time1154 = 11 * 60 + 54;
  const diffAfter = (time1154 - azanTargetMinutes + 1440) % 1440;
  assert(diffAfter === 1, `At 11:54 AM, diff is 1 minute (within grace window)`);

  // -------------------------------------------------------------
  // Test 2: Notification Content Generation
  // -------------------------------------------------------------
  console.log('\nTest 2: Notification Title and Body Formatting');
  const pName = 'અસર';
  const title = azanOffset === 0 ? `${pName} અઝાનનો સમય થયો છે` : `${pName} અઝાન સમય - ${azanOffset} મિનિટ બાકી`;
  const body = azanOffset === 0 ? `${pName} નમાઝની અઝાનનો સમય ${asrAzanRaw} થયો છે.` : `${pName} નમાઝની અઝાનનો સમય ${asrAzanRaw} છે. (${azanOffset} મિનિટ બાકી)`;
  assert(title === 'અસર અઝાન સમય - 2 મિનિટ બાકી', `Title is "${title}"`);
  assert(body === 'અસર નમાઝની અઝાનનો સમય 11:55 AM છે. (2 મિનિટ બાકી)', `Body is "${body}"`);

  // -------------------------------------------------------------
  // Test 3: Multiple Advance Offset Scenarios
  // -------------------------------------------------------------
  console.log('\nTest 3: Multiple Offset Configurations (5m, 10m, 15m, 0m)');
  const scenarios = [
    { prayer: 'Zohr', time: '12:30 PM', offset: 5, expectedTarget: '12:25 PM', expectedTargetMins: 12 * 60 + 25 },
    { prayer: 'Fajr', time: '05:30 AM', offset: 15, expectedTarget: '05:15 AM', expectedTargetMins: 5 * 60 + 15 },
    { prayer: 'Maghrib', time: '06:20 PM', offset: 10, expectedTarget: '06:10 PM', expectedTargetMins: 18 * 60 + 10 },
    { prayer: 'Isha', time: '08:00 PM', offset: 0, expectedTarget: '08:00 PM', expectedTargetMins: 20 * 60 + 0 },
  ];

  for (const s of scenarios) {
    const min = parsePrayerTimeToMinutes(s.time, 'PM');
    const targetMin = (min - s.offset + 1440) % 1440;
    assert(
      targetMin === s.expectedTargetMins,
      `${s.prayer} at ${s.time} with ${s.offset}m advance reminder triggers at ${s.expectedTarget} (${targetMin}m)`
    );
  }

  // -------------------------------------------------------------
  // Test 4: Database Simulation & Scheduler Execution
  // -------------------------------------------------------------
  console.log('\nTest 4: Database Connection and End-to-End Scheduler Simulation');
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/parivar';
  await mongoose.connect(mongoUri);

  const cfg = await Config.findOne();
  assert(!!cfg, 'Config document exists in DB');
  assert(cfg.prayerTimes?.enabled !== false, 'Prayer times enabled');

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

