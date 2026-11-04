const mongoose = require('mongoose');
const { getRegistryConnection, getTenantConnection } = require('../config/registryDb');
const tenantSchema = require('../models/tenantSchema');
const { createAndBroadcast } = require('../controllers/notificationController');
const { publicUrl } = require('../utils/apiResponse');
const { tenantContext } = require('../utils/tenantContext');
const Config = require('../models/configModel');

let schedulerInterval = null;
let isRunning = false;

/**
 * Returns year, month (1-12), day (1-31), weekday ('Mon'..'Sun'), dateStr, monthStr in Asia/Kolkata
 */
const getKolkataDateParts = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  }).formatToParts(d);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    weekday: map.weekday,
    dateStr: `${map.year}-${String(map.month).padStart(2, '0')}-${String(map.day).padStart(2, '0')}`,
    monthStr: `${map.year}-${String(map.month).padStart(2, '0')}`
  };
};

/**
 * Checks all active database connections (default + tenants)
 * for events and news whose date/start_time has arrived and sends reminder notifications.
 */
const checkAndSendScheduledNotifications = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    // Look for events/news scheduled on or before now (within a 24h grace window)
    const gracePastWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Gather all connections to check: default mongoose connection + all active tenant DBs
    const connectionsToCheck = [{ conn: mongoose.connection, name: 'default' }];

    try {
      const registryConn = await getRegistryConnection();
      const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', tenantSchema);
      const activeTenants = await Tenant.find({ status: { $ne: 0 } }).lean();

      for (const tenant of activeTenants) {
        if (tenant.slug) {
          const dbName = tenant.slug.startsWith('parivar_') ? tenant.slug : `parivar_${tenant.slug}`;
          const tConn = await getTenantConnection(dbName);
          if (tConn && tConn.readyState === 1) {
            connectionsToCheck.push({ conn: tConn, name: dbName });
          }
        }
      }
    } catch (err) {
      console.warn('[Scheduler Registry Warning]:', err.message);
    }

    // 2. Iterate through each database connection and process due reminders
    for (const { conn, name } of connectionsToCheck) {
      if (!conn || conn.readyState !== 1) continue;

      await tenantContext.run({ tenantConn: conn }, async () => {
        const Event = conn.models.Event;
        const News = conn.models.News;

      // Process Events
      if (Event) {
        try {
          const dueEvents = await Event.find({
            status: 1,
            send_notification: { $ne: false },
            reminder_sent: { $ne: true },
            start_time: { $exists: true, $ne: null, $lte: now, $gte: gracePastWindow }
          }).lean();

          for (const ev of dueEvents) {
            console.log(`[Scheduler] ⏰ Auto-sending event reminder for "${ev.title}" in DB [${name}]`);

            // Mark as sent first to prevent duplicate sends across concurrent runs
            await Event.updateOne({ _id: ev._id }, { $set: { reminder_sent: true } });

            const fakeReq = {
              protocol: 'http',
              get: (header) => (header === 'host' ? 'localhost:5000' : ''),
              tenantConn: conn
            };

            const imageUrl = ev.image ? publicUrl(fakeReq, ev.image) : '';
            const eventDate = ev.start_time || ev.event_date || ev.createdAt || '';

            await createAndBroadcast({
              title: `Event Reminder: ${ev.title}`,
              body: ev.description?.slice(0, 150) || `Today is ${ev.title}! Don't forget to join.`,
              image: imageUrl,
              type: 'event',
              ref_id: String(ev._id || ev.id),
              date: eventDate,
              event_location: ev.event_location || '',
              target_type: ev.target_type || 'all',
              target_users: ev.target_users || []
            });
          }
        } catch (eventErr) {
          console.error(`[Scheduler Event Error in ${name}]:`, eventErr.message);
        }
      }

      // Process News
      if (News) {
        try {
          const dueNews = await News.find({
            status: 1,
            send_notification: { $ne: false },
            reminder_sent: { $ne: true },
            date: { $exists: true, $ne: null, $lte: now, $gte: gracePastWindow }
          }).lean();

          for (const nw of dueNews) {
            console.log(`[Scheduler] 📰 Auto-sending news reminder for "${nw.title}" in DB [${name}]`);

            // Mark as sent first
            await News.updateOne({ _id: nw._id }, { $set: { reminder_sent: true } });

            const fakeReq = {
              protocol: 'http',
              get: (header) => (header === 'host' ? 'localhost:5000' : ''),
              tenantConn: conn
            };

            const imageUrl = nw.image ? publicUrl(fakeReq, nw.image) : '';
            const newsDate = nw.date || nw.cdate || nw.createdAt || '';

            await createAndBroadcast({
              title: nw.title,
              body: nw.description?.slice(0, 150) || nw.content?.slice(0, 150) || '',
              image: imageUrl,
              type: 'news',
              ref_id: String(nw._id || nw.id),
              date: newsDate,
              target_type: nw.target_type || 'all',
              target_users: nw.target_users || []
            });
          }
        } catch (newsErr) {
          console.error(`[Scheduler News Error in ${name}]:`, newsErr.message);
        }
      }

      // Process Birthdays & Anniversaries
      const User = conn.models.User;
      if (User) {
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentDay = now.getDate(); // 1-31
        const currentYear = now.getFullYear();

        // End of today (23:59:59.999) for auto-expiring birthday/anniversary greeting
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // 1. Process Today's Birthdays
        try {
          const birthdayUsers = await User.find({
            status: { $ne: 0 },
            dob: { $exists: true, $ne: null },
            $or: [
              { birthday_notification_year: { $ne: currentYear } },
              { birthday_notification_year: { $exists: false } },
              { birthday_notification_year: null }
            ],
            $expr: {
              $and: [
                { $eq: [{ $type: "$dob" }, "date"] },
                { $eq: [{ $month: "$dob" }, currentMonth] },
                { $eq: [{ $dayOfMonth: "$dob" }, currentDay] }
              ]
            }
          }).lean();

          for (const bUser of birthdayUsers) {
            const memberName = [bUser.first_name, bUser.middle_name, bUser.last_name].filter(Boolean).join(' ') || 'Member';
            console.log(`[Scheduler] 🎂 Auto-sending Birthday Wish specifically to "${memberName}" in DB [${name}]`);

            // Mark as notified for current year
            await User.updateOne({ _id: bUser._id }, { $set: { birthday_notification_year: currentYear } });

            const fakeReq = {
              protocol: 'http',
              get: (header) => (header === 'host' ? 'localhost:5000' : ''),
              tenantConn: conn
            };
            const userImage = bUser.image || bUser.profile_image ? publicUrl(fakeReq, bUser.image || bUser.profile_image) : '';

            await createAndBroadcast({
              title: `🎂 Happy Birthday ${memberName}!`,
              body: `Wishing you a very Happy Birthday filled with joy, peace, and prosperity! 🎉`,
              image: userImage,
              type: 'birthday',
              ref_id: String(bUser._id || bUser.id),
              target_type: 'specific', // Send specifically to the user whose birthday it is
              target_users: [bUser._id],
              expires_at: endOfToday // Disappears automatically when the day ends
            });
          }
        } catch (bErr) {
          console.error(`[Scheduler Birthday Error in ${name}]:`, bErr.message);
        }

        // 2. Process Today's Anniversaries
        try {
          const anniversaryUsers = await User.find({
            status: { $ne: 0 },
            anniversary: { $exists: true, $ne: null },
            $or: [
              { anniversary_notification_year: { $ne: currentYear } },
              { anniversary_notification_year: { $exists: false } },
              { anniversary_notification_year: null }
            ],
            $expr: {
              $and: [
                { $eq: [{ $type: "$anniversary" }, "date"] },
                { $eq: [{ $month: "$anniversary" }, currentMonth] },
                { $eq: [{ $dayOfMonth: "$anniversary" }, currentDay] }
              ]
            }
          }).lean();

          for (const aUser of anniversaryUsers) {
            const memberName = [aUser.first_name, aUser.middle_name, aUser.last_name].filter(Boolean).join(' ') || 'Member';
            console.log(`[Scheduler] 💐 Auto-sending Anniversary Wish specifically to "${memberName}" in DB [${name}]`);

            // Mark as notified for current year
            await User.updateOne({ _id: aUser._id }, { $set: { anniversary_notification_year: currentYear } });

            const fakeReq = {
              protocol: 'http',
              get: (header) => (header === 'host' ? 'localhost:5000' : ''),
              tenantConn: conn
            };
            const userImage = aUser.image || aUser.profile_image ? publicUrl(fakeReq, aUser.image || aUser.profile_image) : '';

            await createAndBroadcast({
              title: `💐 Happy Wedding Anniversary ${memberName}!`,
              body: `Warmest congratulations on your Wedding Anniversary! Wishing you endless love, happiness & togetherness. 🎊`,
              image: userImage,
              type: 'anniversary',
              ref_id: String(aUser._id || aUser.id),
              target_type: 'specific', // Send specifically to the user whose anniversary it is
              target_users: [aUser._id],
              expires_at: endOfToday // Disappears automatically when the day ends
            });
          }
        } catch (aErr) {
          console.error(`[Scheduler Anniversary Error in ${name}]:`, aErr.message);
        }

        // 3. Process Overdue Mandal Contributions Notification (When month has ended, e.g. 1st day of month)
        try {
          const Mandal = conn.models.Mandal;
          const MandalContribution = conn.models.MandalContribution;

          // If today is the 1st day of the month (or after the due day), notify members who haven't paid previous month
          if (Mandal && MandalContribution) {
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
            const reminderTrackKey = `mandal_reminder_${prevMonthStr}`;

            const activeMandals = await Mandal.find({ status: 1 }).lean();

            for (const mandal of activeMandals) {
              const memberIds = mandal.members || [];
              if (!memberIds.length) continue;

              // Find pending contributions for previous month
              const pendingList = await MandalContribution.find({
                mandal_id: mandal._id,
                month: prevMonthStr,
                member_id: { $in: memberIds },
                status: { $ne: 'Paid' },
                overdue_notified_month: { $ne: prevMonthStr }
              }).populate('member_id', 'first_name last_name number fcm_token').lean();

              for (const item of pendingList) {
                const uId = item.member_id?._id || item.member_id;
                if (!uId) continue;
                const mName = item.member_name || `${item.member_id?.first_name || ''} ${item.member_id?.last_name || ''}`.trim() || 'સભ્યશ્રી';
                const amt = item.expected_amount || mandal.monthly_amount || 500;

                console.log(`[Scheduler] 🔔 Auto-sending Overdue Mandal notification to "${mName}" for month ${prevMonthStr}`);

                await MandalContribution.updateOne(
                  { _id: item._id },
                  { $set: { overdue_notified_month: prevMonthStr } }
                );

                await createAndBroadcast({
                  title: `મંડળ યોગદાન બાકી નોટિફિકેશન (${mandal.name})`,
                  body: `આદરણીય ${mName}, મહિનો ${prevMonthStr} પૂર્ણ થઈ ગયો છે અને તમારું યોગદાન ₹${Number(amt).toLocaleString('en-IN')} બાકી છે. કૃપા કરીને જમા કરાવી આપશો.`,
                  type: 'mandal',
                  ref_id: String(mandal._id),
                  target_type: 'specific',
                  target_users: [String(uId)]
                });
              }
            }
          }
        } catch (mandalErr) {
          console.error(`[Scheduler Mandal Overdue Error in ${name}]:`, mandalErr.message);
        }

        // 4. Process Scheduled Death Remembrance Notifications to Family Head & Living Family Members
        // Schedule:
        // - Every Friday: Jummah Dua / Isaal-e-Sawab reminder (for first 1 year)
        // - Monthly on same date: Masik Barsi reminder (e.g. 04/12, 04/01... for first 1 year)
        // - Yearly on death anniversary: Annual Barsi reminder (e.g. 04/11/2027, 04/11/2028...)
        // - Target audience: ONLY the living family members and the family head of the deceased person!
        try {
          const nowParts = getKolkataDateParts(now);

          // Find all deceased members who have a valid death_date
          const deceasedMembers = await User.find({
            status: { $ne: 0 },
            is_deceased: true,
            death_date: { $exists: true, $ne: null }
          }).lean();

          for (const deceased of deceasedMembers) {
            const deathDateObj = new Date(deceased.death_date);
            if (isNaN(deathDateObj.getTime())) continue;

            const deathParts = getKolkataDateParts(deathDateObj);

            // Calculate days elapsed since death
            const diffMs = now.getTime() - deathDateObj.getTime();
            const daysSinceDeath = Math.floor(diffMs / (24 * 60 * 60 * 1000));

            // Don't send recurring reminders on the exact day of death (day 0), as initial announcement was already broadcast
            if (daysSinceDeath < 1) continue;

            // Determine if today qualifies for any of the 3 notification types:
            let notificationType = null; // 'barsi' | 'monthly' | 'friday'
            let notifTitle = '';
            let notifBody = '';
            let updateField = {};

            const isFemale = String(deceased.gender || '').toLowerCase() === 'female';
            const titlePrefix = isFemale ? 'Marhuma (મરહૂમા)' : 'Marhum (મરહૂમ)';
            const memberName = [deceased.first_name, deceased.middle_name, deceased.last_name].filter(Boolean).join(' ') || deceased.name || 'Family Member';

            // Check 1: Annual Barsi (Same month & day, year > death year)
            const isAnnualBarsi =
              nowParts.month === deathParts.month &&
              nowParts.day === deathParts.day &&
              nowParts.year > deathParts.year;

            if (isAnnualBarsi && deceased.last_death_barsi_year !== nowParts.year) {
              const yearsCompleted = nowParts.year - deathParts.year;
              notificationType = 'barsi';
              notifTitle = `🕯️ વાર્ષિક બરસી (${yearsCompleted} Year Barsi) - ${titlePrefix} ${memberName}`;
              notifBody = `આજે ${titlePrefix} ${memberName} ની ${yearsCompleted}મી વાર્ષિક વફાત તારીખ (Barsi) છે. અલ્લાહ પાક મરહૂમની મગફિરત ફરમાવે અને જન્નતુલ ફિરદોસમાં આલા મકામ આપે. આમીન.`;
              updateField = { last_death_barsi_year: nowParts.year, death_notification_last_sent: now };
            }

            // Check 2: Monthly same date (Masik Barsi) within 1st year
            // Runs from month 1 to month 11 (daysSinceDeath >= 25 && daysSinceDeath < 360)
            if (!notificationType && daysSinceDeath >= 25 && daysSinceDeath < 360) {
              const daysInMonth = new Date(nowParts.year, nowParts.month, 0).getDate();
              const effectiveDeathDay = Math.min(deathParts.day, daysInMonth);

              if (nowParts.day === effectiveDeathDay && deceased.last_death_monthly_month !== nowParts.monthStr) {
                let monthsPassed = (nowParts.year - deathParts.year) * 12 + (nowParts.month - deathParts.month);
                if (monthsPassed > 0 && monthsPassed < 12) {
                  notificationType = 'monthly';
                  notifTitle = `🕊️ માસિક વફાત સ્મરણ (${monthsPassed} મહિનો) - ${titlePrefix} ${memberName}`;
                  notifBody = `આજે ${titlePrefix} ${memberName} ની માસિક વફાત તારીખ (Masik Barsi) છે. અલ્લાહ પાક મરહૂમની મગફિરત ફરમાવે અને તમામ ઘરવાળાઓને સબર આપે. ખાસ દુઆ કરશો.`;
                  updateField = { last_death_monthly_month: nowParts.monthStr, death_notification_last_sent: now };
                }
              }
            }

            // Check 3: Every Friday (Jummah Isaal-e-Sawab reminder) within 1st year
            if (!notificationType && daysSinceDeath >= 1 && daysSinceDeath < 365) {
              if (nowParts.weekday === 'Fri' && deceased.last_death_friday_date !== nowParts.dateStr) {
                notificationType = 'friday';
                notifTitle = `🕊️ શુક્રવાર દુઆ - ${titlePrefix} ${memberName}`;
                notifBody = `આજે પવિત્ર શુક્રવાર (Jummah) છે. મરહૂમ ${memberName} ની મગફિરત અને ઇસાલે સવાબ માટે ખાસ દુઆ-એ-મગફિરત કરશો.`;
                updateField = { last_death_friday_date: nowParts.dateStr, death_notification_last_sent: now };
              }
            }

            // If none of the 3 conditions are met today, skip
            if (!notificationType) continue;

            // Determine Family Head ID and living family members
            const isHead = deceased.familyHead === true || deceased.relation === 'Self' || !deceased.family_head?.id;
            const headId = isHead
              ? deceased._id
              : (deceased.family_head?.id || deceased.family_head?._id || deceased.parent_id);

            if (!headId) continue;

            const headIdStr = String(headId);
            const headObjectId = mongoose.Types.ObjectId.isValid(headId) ? new mongoose.Types.ObjectId(headIdStr) : null;

            const orConditions = [
              { _id: headIdStr },
              { 'family_head.id': headIdStr },
              { 'family_head._id': headIdStr },
              { parent_id: headIdStr }
            ];
            if (headObjectId) {
              orConditions.push(
                { _id: headObjectId },
                { 'family_head.id': headObjectId },
                { 'family_head._id': headObjectId },
                { parent_id: headObjectId }
              );
            }
            if (deceased.member_id) {
              orConditions.push({ parent_member_id: deceased.member_id });
            }
            if (deceased.parent_member_id) {
              orConditions.push(
                { member_id: deceased.parent_member_id },
                { parent_member_id: deceased.parent_member_id }
              );
            }

            // Find ONLY living Family Head and living family members
            const recipients = await User.find({
              _id: { $ne: deceased._id },
              status: { $ne: 0 },
              is_deceased: { $ne: true },
              $or: orConditions
            }).select('_id first_name last_name gender village fcm_token fcm_tokens').lean();

            if (!recipients || recipients.length === 0) continue;

            // Atomic update to mark notification sent and prevent duplicate dispatch
            const updateFilter = { _id: deceased._id };
            if (updateField.last_death_barsi_year) updateFilter.last_death_barsi_year = { $ne: updateField.last_death_barsi_year };
            if (updateField.last_death_monthly_month) updateFilter.last_death_monthly_month = { $ne: updateField.last_death_monthly_month };
            if (updateField.last_death_friday_date) updateFilter.last_death_friday_date = { $ne: updateField.last_death_friday_date };

            const updated = await User.findOneAndUpdate(
              updateFilter,
              {
                $set: updateField,
                $inc: { death_notification_count: 1 }
              }
            );

            if (!updated) continue;

            const recipientIds = recipients.map(r => String(r._id));
            console.log(`[Scheduler] 🕊️ Auto-sending ${notificationType} death remembrance for "${memberName}" to ${recipientIds.length} family recipients in DB [${name}]`);

            const fakeReq = {
              protocol: 'http',
              get: (header) => (header === 'host' ? 'localhost:5000' : ''),
              tenantConn: conn
            };
            const userImage = deceased.image || deceased.profile_image ? publicUrl(fakeReq, deceased.image || deceased.profile_image) : '';

            await createAndBroadcast({
              title: notifTitle,
              body: notifBody,
              image: userImage,
              type: 'death',
              ref_id: String(deceased._id),
              date: now,
              target_type: 'specific',
              target_users: recipientIds
            });
          }
        } catch (deathErr) {
          console.error(`[Scheduler Death Scheduled Error in ${name}]:`, deathErr.message);
        }
      }

      // -------------------------------------------------------------
      // Process Weekly Scheduled Push Notifications (Monday & Friday)
      // -------------------------------------------------------------
      try {
        let cfg = await Config.findOne();
        if (!cfg) {
          try {
            cfg = await Config.create({ name: 'Parivar' });
          } catch (_) {
            cfg = {
              mondayPushEnabled: true,
              mondayPushTime: '09:00',
              fridayPushEnabled: true,
              fridayPushKey: 'jummah_mubarak',
              fridayPushTime: '10:00'
            };
          }
        }

        if (cfg) {
          // Calculate current time & date in Asia/Kolkata
          const kolkataFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            hourCycle: 'h23',
            weekday: 'short'
          });
          const parts = kolkataFormatter.formatToParts(now);
          const partMap = {};
          parts.forEach(p => { partMap[p.type] = p.value; });
          const currentTimeStr = `${partMap.hour}:${partMap.minute}`;
          const todayDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
          const currentDayName = partMap.weekday; // 'Mon', 'Fri', etc.
          // Helper to convert 12-hour (or 24-hour) string to 24-hour HH:mm for reliable comparison
          const parseTimeTo24Hour = (timeStr) => {
            if (!timeStr) return '09:00';
            const trimmed = String(timeStr).trim();
            const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (!ampmMatch) return trimmed;
            let hours = parseInt(ampmMatch[1], 10);
            const minutes = ampmMatch[2];
            const period = ampmMatch[3]?.toUpperCase();
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            return `${String(hours).padStart(2, '0')}:${minutes}`;
          };

          // 1. Monday Scheduled Push Notification
          if (currentDayName === 'Mon') {
            const targetMondayTime = parseTimeTo24Hour(cfg.mondayPushTime || '09:00');
            if (cfg.lastMondayPushDate !== todayDateStr && currentTimeStr >= targetMondayTime) {
              console.log(`[Scheduler] 🚀 [${name}] Auto-triggering Monday Push Notification at ${currentTimeStr} (scheduled: ${cfg.mondayPushTime || targetMondayTime})`);
              await Config.updateOne({ _id: cfg._id }, { $set: { lastMondayPushDate: todayDateStr } });

              await createAndBroadcast({
                title: `${cfg.name || 'Parivar'} - સાપ્તાહિક અપડેટ`,
                body: `નવા અઠવાડિયાની શુભકામનાઓ! સમુદાયની નવીનતમ માહિતી અને ગતિવિધિઓ જુઓ.`,
                type: 'weekly_monday',
                target_type: 'all',
                target_users: [],
                date: now,
                monday_time: cfg.mondayPushTime || targetMondayTime
              });
            }
          }

          // 2. Friday Scheduled Push Notification
          if (currentDayName === 'Fri') {
            const targetFridayTime = parseTimeTo24Hour(cfg.fridayPushTime || '10:00');
            if (cfg.lastFridayPushDate !== todayDateStr && currentTimeStr >= targetFridayTime) {
              const fridayKey = (cfg.fridayPushKey || 'jummah_mubarak').trim();
              console.log(`[Scheduler] 🚀 [${name}] Auto-triggering Friday Push Notification at ${currentTimeStr} with key [${fridayKey}] (scheduled: ${cfg.fridayPushTime || targetFridayTime})`);
              await Config.updateOne({ _id: cfg._id }, { $set: { lastFridayPushDate: todayDateStr } });

              await createAndBroadcast({
                title: `${cfg.name || 'Parivar'} - શુક્રવાર સંદેશ`,
                body: `આપ સૌને શુક્રવાર મુબારક! અઠવાડિયાની વિશેષ માહિતી અને અપડેટ્સ તપાસો.`,
                type: 'weekly_friday',
                target_type: 'all',
                target_users: [],
                date: now,
                key: fridayKey,
                friday_key: fridayKey,
                friday_push_key: fridayKey,
                push_key: fridayKey
              });
            }
          }

          // -------------------------------------------------------------
          // 3. Daily Prayer Push Notifications (Azan, Jamat, Qaza with Advance Reminder Timing)
          // -------------------------------------------------------------
          try {
            const pt = cfg.prayerTimes ? (cfg.prayerTimes.toObject ? cfg.prayerTimes.toObject() : cfg.prayerTimes) : null;
            const isFalsy = (v) => v === false || v === 'false' || v === 0 || v === '0';
            const isNotificationsOff = !pt || isFalsy(pt.notificationsEnabled) || isFalsy(pt.notifications_enabled) || isFalsy(pt.enabled);
            const isNotificationsOn = !isNotificationsOff;
            if (isNotificationsOn) {
              let currentHour = parseInt(partMap.hour, 10);
              if (currentHour === 24) currentHour = 0;
              const currentMinute = parseInt(partMap.minute, 10);
              const nowMinutes = currentHour * 60 + currentMinute;

              const prayers = [
                { key: 'fajr', name: 'ફજર', defaultAzan: '05:26', defaultJamat: '05:40', defaultQaza: '06:42', period: 'AM', qazaPeriod: 'AM' },
                { key: 'zohr', name: 'ઝોહર', defaultAzan: '12:28', defaultJamat: '12:45', defaultQaza: '04:36', period: 'PM', qazaPeriod: 'PM' },
                { key: 'asr', name: 'અસર', defaultAzan: '04:36', defaultJamat: '04:50', defaultQaza: '06:16', period: 'PM', qazaPeriod: 'PM' },
                { key: 'maghrib', name: 'મગરીબ', defaultAzan: '06:16', defaultJamat: '06:18', defaultQaza: '07:29', period: 'PM', qazaPeriod: 'PM' },
                { key: 'isha', name: 'ઈશા', defaultAzan: '07:29', defaultJamat: '07:45', defaultQaza: '05:25', period: 'PM', qazaPeriod: 'AM' }
              ];

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
                // Handle common 12:xx AM typo for afternoon prayer (e.g. Zohr 12:45)
                if (h === 12 && p === 'AM' && defaultPeriod === 'PM') {
                  p = 'PM';
                }
                if (p === 'PM' && h < 12) h += 12;
                if (p === 'AM' && h === 12) h = 0;
                return h * 60 + m;
              };

              let sentAlerts = cfg.prayerAlertsSent || {};
              if (typeof sentAlerts !== 'object') sentAlerts = {};
              const todaySent = { ...(sentAlerts[todayDateStr] || {}) };
              let alertsUpdated = false;

              // Dynamic offsets (minutes before prayer timing)
              const azanOffset = Number.isInteger(parseInt(pt.azanOffsetMinutes, 10))
                ? parseInt(pt.azanOffsetMinutes, 10)
                : 25;
              const jamatOffset = Number.isInteger(parseInt(pt.jamatOffsetMinutes, 10))
                ? parseInt(pt.jamatOffsetMinutes, 10)
                : 15;
              const qazaOffset = Number.isInteger(parseInt(pt.qazaOffsetMinutes, 10))
                ? parseInt(pt.qazaOffsetMinutes, 10)
                : 15;

              for (const prayer of prayers) {
                const pData = pt[prayer.key] || {};
                const pName = pData.name || prayer.name;

                // A. Azan Alert: Trigger dynamic minutes prior to Azan time
                const azanRaw = pData.azan || prayer.defaultAzan;
                const azanMinutes = parsePrayerTimeToMinutes(azanRaw, prayer.period);
                if (azanMinutes !== null) {
                  const azanTargetMinutes = (azanMinutes - azanOffset + 1440) % 1440;
                  const azanSentKey = `${prayer.key}_azan_${azanRaw}_${azanOffset}m`;

                  if (!todaySent[azanSentKey]) {
                    const diff = (nowMinutes - azanTargetMinutes + 1440) % 1440;
                    if (diff >= 0 && diff <= 15) {
                      const alertKey = `${prayer.key}_azan`;
                      console.log(`[Scheduler] 🕌 [${name}] Auto-triggering Azan notification for "${pName}" at ${currentTimeStr} (Azan: ${azanRaw}, Key: [${alertKey}], ${azanOffset}m prior)`);

                      todaySent[azanSentKey] = true;
                      alertsUpdated = true;

                      const azanTitle = azanOffset === 0
                        ? `${pName} અઝાનનો સમય થયો છે`
                        : `${pName} અઝાન સમય - ${azanOffset} મિનિટ બાકી`;
                      const azanBody = azanOffset === 0
                        ? `${pName} નમાઝની અઝાનનો સમય ${azanRaw} થયો છે.`
                        : `${pName} નમાઝની અઝાનનો સમય ${azanRaw} છે. (${azanOffset} મિનિટ બાકી)`;

                      await createAndBroadcast({
                        title: azanTitle,
                        body: azanBody,
                        type: 'prayer_reminder',
                        target_type: 'all',
                        target_users: [],
                        date: now,
                        key: alertKey,
                        push_key: alertKey,
                        prayer_key: alertKey,
                        prayer: prayer.key,
                        prayer_name: pName,
                        prayer_type: 'azan',
                        prayer_time: azanRaw,
                        lead_minutes: azanOffset
                      });
                    }
                  }
                }

                // B. Jamat Alert: Trigger dynamic minutes prior to Jamat time
                const jamatRaw = pData.jamat || prayer.defaultJamat;
                const jamatMinutes = parsePrayerTimeToMinutes(jamatRaw, prayer.period);
                if (jamatMinutes !== null) {
                  const jamatTargetMinutes = (jamatMinutes - jamatOffset + 1440) % 1440;
                  const jamatSentKey = `${prayer.key}_jamat_${jamatRaw}_${jamatOffset}m`;

                  if (!todaySent[jamatSentKey]) {
                    const diff = (nowMinutes - jamatTargetMinutes + 1440) % 1440;
                    if (diff >= 0 && diff <= 15) {
                      const alertKey = `${prayer.key}_jamat`;
                      console.log(`[Scheduler] 🕌 [${name}] Auto-triggering Jamat notification for "${pName}" at ${currentTimeStr} (Jamat: ${jamatRaw}, Key: [${alertKey}], ${jamatOffset}m prior)`);

                      todaySent[jamatSentKey] = true;
                      alertsUpdated = true;

                      const jamatTitle = jamatOffset === 0
                        ? `${pName} જમાતનો સમય થયો છે`
                        : `${pName} જમાત સમય - ${jamatOffset} મિનિટ બાકી`;
                      const jamatBody = jamatOffset === 0
                        ? `${pName} નમાઝની જમાતનો સમય ${jamatRaw} થયો છે.`
                        : `${pName} નમાઝની જમાતનો સમય ${jamatRaw} છે. (${jamatOffset} મિનિટ બાકી)`;

                      await createAndBroadcast({
                        title: jamatTitle,
                        body: jamatBody,
                        type: 'prayer_reminder',
                        target_type: 'all',
                        target_users: [],
                        date: now,
                        key: alertKey,
                        push_key: alertKey,
                        prayer_key: alertKey,
                        prayer: prayer.key,
                        prayer_name: pName,
                        prayer_type: 'jamat',
                        prayer_time: jamatRaw,
                        lead_minutes: jamatOffset
                      });
                    }
                  }
                }

                // C. Qaza Alert: Trigger dynamic minutes prior to Qaza time
                const qazaRaw = pData.qaza || prayer.defaultQaza;
                const qazaMinutes = parsePrayerTimeToMinutes(qazaRaw, prayer.qazaPeriod || prayer.period);
                if (qazaMinutes !== null) {
                  const qazaTargetMinutes = (qazaMinutes - qazaOffset + 1440) % 1440;
                  const qazaSentKey = `${prayer.key}_qaza_${qazaRaw}_${qazaOffset}m`;

                  if (!todaySent[qazaSentKey]) {
                    const diff = (nowMinutes - qazaTargetMinutes + 1440) % 1440;
                    if (diff >= 0 && diff <= 15) {
                      const alertKey = `${prayer.key}_qaza`;
                      console.log(`[Scheduler] 🕌 [${name}] Auto-triggering Qaza notification for "${pName}" at ${currentTimeStr} (Qaza: ${qazaRaw}, Key: [${alertKey}], ${qazaOffset}m prior)`);

                      todaySent[qazaSentKey] = true;
                      alertsUpdated = true;

                      const qazaTitle = qazaOffset === 0
                        ? `${pName} નમાઝ કઝા થઈ ગઈ છે`
                        : `${pName} કઝા સમય - ${qazaOffset} મિનિટ બાકી`;
                      const qazaBody = qazaOffset === 0
                        ? `${pName} નમાઝનો સમય સમાપ્ત થયો છે (કઝા સમય: ${qazaRaw}).`
                        : `${pName} નમાઝ કઝા થવામાં ${qazaOffset} મિનિટ બાકી છે (કઝા સમય: ${qazaRaw}). જલદી નમાઝ અદા કરી લો.`;

                      await createAndBroadcast({
                        title: qazaTitle,
                        body: qazaBody,
                        type: 'prayer_reminder',
                        target_type: 'all',
                        target_users: [],
                        date: now,
                        key: alertKey,
                        push_key: alertKey,
                        prayer_key: alertKey,
                        prayer: prayer.key,
                        prayer_name: pName,
                        prayer_type: 'qaza',
                        prayer_time: qazaRaw,
                        lead_minutes: qazaOffset
                      });
                    }
                  }
                }
              }

              if (alertsUpdated) {
                sentAlerts[todayDateStr] = todaySent;
                const dates = Object.keys(sentAlerts);
                if (dates.length > 7) {
                  dates.slice(0, dates.length - 7).forEach(d => delete sentAlerts[d]);
                }
                await Config.updateOne(
                  { _id: cfg._id },
                  { $set: { prayerAlertsSent: sentAlerts } }
                );
              }
            }
          } catch (prayerErr) {
            console.error(`[Scheduler Prayer Push Error in ${name}]:`, prayerErr.message);
          }
        }
      } catch (weeklyErr) {
        console.error(`[Scheduler Weekly Push Error in ${name}]:`, weeklyErr.message);
      }
    });
  }
  } catch (globalErr) {
    console.error('[ScheduledNotificationService Global Error]:', globalErr.message);
  } finally {
    isRunning = false;
  }
};



/**
 * Starts the recurring scheduler interval (e.g. checks every 1 minute)
 */
const startScheduler = (intervalMs = 30 * 1000) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Run initial check after 5 seconds of boot
  setTimeout(() => {
    checkAndSendScheduledNotifications();
  }, 5000);

  // Setup periodic interval
  schedulerInterval = setInterval(() => {
    checkAndSendScheduledNotifications();
  }, intervalMs);

  console.log(`[Scheduler] 🚀 Automated Scheduled Notification Service active (Interval: ${intervalMs / 1000}s)`);
};

const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
  checkAndSendScheduledNotifications
};
