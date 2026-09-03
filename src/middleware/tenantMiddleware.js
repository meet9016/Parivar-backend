const { tenantContext } = require('../utils/tenantContext');
const { getTenantConnection } = require('../config/registryDb');

/**
 * Middleware to intercept tenant identifier from request headers
 * and initialize the tenant context for Mongoose models.
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    const tenantSlug = req.headers['x-tenant-id']?.toLowerCase();
    console.log(tenantSlug,"tenantSlug");
    
    if (!tenantSlug) {
      // If no tenant is specified, proceed with default connection
      // This ensures existing parivar/users are unaffected.
      return next();
    }

    // Determine the database name
    // e.g. slug "patel" -> db "parivar_patel"
    // Also support passing the full db name for flexibility
    const dbName = tenantSlug.startsWith('parivar_') ? tenantSlug : `parivar_${tenantSlug}`;

    // Check if the tenant is suspended in the central registry
    const { getRegistryConnection } = require('../config/registryDb');
    const tenantSchema = require('../models/tenantSchema');
    const registryConn = await getRegistryConnection();
    const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', tenantSchema);
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (tenant && tenant.status === 0) {
      return res.status(403).json({
        status: 403,
        message: 'Access denied: Your Parivar community account has been suspended.',
        data: []
      });
    }

    // Get or initialize connection for this tenant
    const tenantConn = await getTenantConnection(dbName);

    // Attach directly to req for reliable access in controllers
    req.tenantConn = tenantConn;

    // Run the rest of the request within this tenant's context
    return tenantContext.run({ tenantConn }, () => {
      next();
    });
  } catch (error) {
    console.error('Tenant Middleware Error:', error.message);
    return res.status(500).json({
      status: 500,
      message: 'Failed to initialize tenant database connection',
      data: []
    });
  }
};

module.exports = tenantMiddleware;
