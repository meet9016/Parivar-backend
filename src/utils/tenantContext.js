const { AsyncLocalStorage } = require('async_hooks');

// Global context to hold tenant information during a request lifecycle
const tenantContext = new AsyncLocalStorage();

/**
 * Creates a Proxy for a Mongoose Model that automatically routes operations 
 * to the correct Tenant DB based on the current AsyncLocalStorage context.
 */
const createTenantProxy = (modelName, schema) => {
  const mongoose = require('mongoose');
  // Eagerly register on default connection to satisfy populate() and mongoose.model() refs
  if (!mongoose.models[modelName]) {
    mongoose.model(modelName, schema);
  }

  return new Proxy(function() {}, {
    construct(target, args) {
      const store = tenantContext.getStore();
      const mongoose = require('mongoose');
      const conn = store?.tenantConn || mongoose.connection;
      const Model = conn.models[modelName] || conn.model(modelName, schema);
      return new Model(...args);
    },
    get(target, prop) {
      if (prop === 'schema') return schema;
      const store = tenantContext.getStore();
      const mongoose = require('mongoose');
      const conn = store?.tenantConn || mongoose.connection;
      const Model = conn.models[modelName] || conn.model(modelName, schema);
      
      const value = Model[prop];
      if (typeof value === 'function') {
        return value.bind(Model);
      }
      return value;
    }
  });
};

module.exports = { tenantContext, createTenantProxy };
