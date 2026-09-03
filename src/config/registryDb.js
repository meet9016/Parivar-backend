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

  const baseUri = process.env.MONGO_URI; // e.g. "mongodb+srv://user:pass@cluster.net/dbname"
  if (!baseUri) throw new Error('MONGO_URI is not defined in .env');

  // Parse the URI and replace the database name with REGISTRY_DB_NAME
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${REGISTRY_DB_NAME}`;
  const registryUri = parsedUri.toString();

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

  // Parse the URI and replace the database name with the tenant dbName
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  const tenantUri = parsedUri.toString();
  
  const conn = await mongoose.createConnection(tenantUri).asPromise();

  ensureTenantModels(conn);

  tenantConnCache[dbName] = conn;
  console.log(`[Tenant] Connected to: ${dbName} ✅`);
  return conn;
};

module.exports = { getRegistryConnection, getTenantConnection, REGISTRY_DB_NAME };
