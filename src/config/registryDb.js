const mongoose = require('mongoose');

const REGISTRY_DB_NAME = 'parivar_registry';

// Cache for registry connection
let registryConn = null;

/**
 * Returns a dedicated Mongoose connection to the central "parivar_registry" database.
 * Re-uses existing connection if already established.
 */
const getRegistryConnection = async () => {
  if (registryConn && registryConn.readyState === 1) {
    return registryConn;
  }

  const baseUri = process.env.MONGO_URI; // e.g. "mongodb+srv://user:pass@cluster.net/"
  if (!baseUri) throw new Error('MONGO_URI is not defined in .env');

  // Build registry DB URI — strip trailing slash then append DB name
  const registryUri = baseUri.replace(/\/?$/, '/') + REGISTRY_DB_NAME;

  registryConn = await mongoose.createConnection(registryUri).asPromise();
  console.log(`[Registry] Connected to: ${REGISTRY_DB_NAME} ✅`);
  return registryConn;
};

/**
 * Returns a Mongoose connection to a specific tenant database.
 * Uses a connection cache keyed by db_name.
 */
const tenantConnCache = {};

/**
 * Ensures all models from the default mongoose connection are cloned
 * into the given tenant connection. Called every request to handle
 * models that may have been registered after the initial connection.
 */
const ensureTenantModels = (conn) => {
  for (const modelName of Object.keys(mongoose.models)) {
    if (!conn.models[modelName]) {
      try {
        conn.model(modelName, mongoose.models[modelName].schema);
      } catch (e) {
        // Ignore "cannot overwrite model" errors
      }
    }
  }
};

const getTenantConnection = async (dbName) => {
  if (tenantConnCache[dbName] && tenantConnCache[dbName].readyState === 1) {
    // Always sync models in case new ones were registered after initial connection
    ensureTenantModels(tenantConnCache[dbName]);
    return tenantConnCache[dbName];
  }

  const baseUri = process.env.MONGO_URI;
  if (!baseUri) throw new Error('MONGO_URI is not defined in .env');

  const tenantUri = baseUri.replace(/\/?$/, '/') + dbName;
  const conn = await mongoose.createConnection(tenantUri).asPromise();

  ensureTenantModels(conn);

  tenantConnCache[dbName] = conn;
  console.log(`[Tenant] Connected to: ${dbName} ✅`);
  return conn;
};

module.exports = { getRegistryConnection, getTenantConnection, REGISTRY_DB_NAME };
