const { tenantContext } = require('../utils/tenantContext');
const { getTenantConnection } = require('../config/registryDb');

/**
 * Middleware to intercept tenant identifier from request headers
 * and initialize the tenant context for Mongoose models.
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    let tenantSlug = req.headers['x-tenant-id']?.toLowerCase();
    
    // Fallback: Extract tenant slug from subdomain if header is missing
    if (!tenantSlug) {
      let hostToParse = req.hostname;
      const origin = req.headers.origin;
      
      // If request comes from a frontend (CORS), use the Origin header's hostname
      if (origin) {
        try {
          hostToParse = new URL(origin).hostname;
        } catch (e) {}
      }

      // If the host ends with .parivar.me, extract the subdomain
      if (hostToParse && hostToParse.endsWith('.parivar.me')) {
        const parts = hostToParse.split('.');
        // e.g. chovatiya.parivar.me -> ['chovatiya', 'parivar', 'me']
        if (parts.length >= 3 && parts[0] !== 'www') {
          tenantSlug = parts[0].toLowerCase();
        }
      }
    }

    console.log(tenantSlug, "tenantSlug");
    
    if (!tenantSlug) {
      // If no tenant is specified (no header and no subdomain), proceed with default connection
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
