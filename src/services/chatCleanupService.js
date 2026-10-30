const mongoose = require('mongoose');
const { getRegistryConnection, getTenantConnection } = require('../config/registryDb');
const tenantSchema = require('../models/tenantSchema');

let cleanupInterval = null;
let isRunning = false;

// 30 days in milliseconds
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// 30 days in seconds (2,592,000)
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * Runs 30-day chat cleanup across default database and all active tenant databases.
 * - Ensures TTL index on `messages.createdAt` is active.
 * - Deletes any messages whose createdAt < 30 days ago.
 * - Cleans up conversation lastMessage references for expired messages.
 */
const runChatCleanup = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

    // 1. Collect all DB connections (default + active tenants)
    const connections = [{ conn: mongoose.connection, name: 'default' }];

    try {
      const registryConn = await getRegistryConnection();
      const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', tenantSchema);
      const activeTenants = await Tenant.find({ status: { $ne: 0 } }).lean();

      for (const tenant of activeTenants) {
        if (tenant.slug) {
          const dbName = tenant.slug.startsWith('parivar_') ? tenant.slug : `parivar_${tenant.slug}`;
          const tConn = await getTenantConnection(dbName);
          if (tConn && tConn.readyState === 1) {
            connections.push({ conn: tConn, name: dbName });
          }
        }
      }
    } catch (err) {
      console.warn('[Chat Cleanup Registry Warning]:', err.message);
    }

    // 2. Perform cleanup on each database
    for (const { conn, name } of connections) {
      if (!conn || conn.readyState !== 1) continue;

      try {
        const Message = conn.models.Message || conn.model('Message', require('../models/Message').schema);
        const Conversation = conn.models.Conversation || conn.model('Conversation', require('../models/Conversation').schema);

        // Ensure TTL index exists on MongoDB collection
        try {
          await Message.collection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: THIRTY_DAYS_SECONDS, background: true }
          );
        } catch (idxErr) {
          // If index already exists with different options, ignore or log
        }

        // Active purge of messages older than 30 days
        const delRes = await Message.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
        if (delRes?.deletedCount > 0) {
          console.log(`[Chat Cleanup - ${name}]: Purged ${delRes.deletedCount} messages older than 30 days.`);
        }

        // Clear lastMessage reference on conversations where lastMessageAt is older than 30 days
        await Conversation.updateMany(
          { lastMessageAt: { $lt: thirtyDaysAgo } },
          { $set: { lastMessage: null } }
        );
      } catch (dbErr) {
        console.error(`[Chat Cleanup Error - ${name}]:`, dbErr.message);
      }
    }
  } catch (err) {
    console.error('[Chat Cleanup Service Error]:', err.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Start the scheduler: runs once on startup and then every 12 hours.
 */
const startScheduler = () => {
  if (cleanupInterval) return;

  // Run on startup (after 5 seconds delay to let DB connections settle)
  setTimeout(() => {
    runChatCleanup();
  }, 5000);

  // Run every 12 hours (12 * 60 * 60 * 1000 ms)
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  cleanupInterval = setInterval(runChatCleanup, TWELVE_HOURS_MS);
  console.log('30-Day Chat Auto-Cleanup Service started (Runs every 12 hours) 🧹');
};

const stopScheduler = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
  runChatCleanup
};

