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
const startScheduler = (intervalMs = 60 * 1000) => {
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
