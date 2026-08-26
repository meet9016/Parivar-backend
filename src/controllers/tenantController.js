const bcrypt = require('bcryptjs');
const { getRegistryConnection, getTenantConnection } = require('../config/registryDb');
const tenantSchema = require('../models/tenantSchema');
const userSchemaRaw = require('../models/userModels'); // we'll re-use the schema
const { apiResponse } = require('../utils/apiResponse');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Convert a parivar name to a safe URL slug.
 * "Patel Parivar" → "patel_parivar"
 * "Shah"          → "shah"
 */
const toSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')   // non-alphanumeric → underscore
    .replace(/^_+|_+$/g, '');       // trim leading/trailing underscores

// ── Controllers ────────────────────────────────────────────────────────────────

/**
 * POST /api/register-parivar
 *
 * Body:
 *   parivar_name   — required  e.g. "Patel Parivar"
 *   admin_first_name  — required
 *   admin_last_name   — optional
 *   admin_email       — required (must be unique)
 *   admin_mobile      — required
 *   admin_password    — optional (default: "Parivar@123")
 *
 * What it does:
 *   1. Validates fields
 *   2. Checks slug uniqueness in the registry DB
 *   3. Creates tenant record in parivar_registry
 *   4. Connects to the new tenant DB (MongoDB creates it on first write)
 *   5. Seeds the admin user into that DB
 *   6. Returns tenant details + admin summary
 */
const registerParivar = async (req, res) => {
  try {
    const {
      parivar_name,
      admin_first_name,
      admin_last_name = '',
      admin_email,
      admin_mobile,
      admin_password = 'Parivar@123',
    } = req.body;

    // ── 1. Validate required fields ──
    if (!parivar_name || !admin_first_name || !admin_email || !admin_mobile) {
      return apiResponse(
        res, 400,
        'parivar_name, admin_first_name, admin_email and admin_mobile are required'
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email)) {
      return apiResponse(res, 400, 'Invalid email format');
    }

    // ── 2. Build slug & db_name ──
    const slug    = toSlug(parivar_name);
    const db_name = `parivar_${slug}`;

    // ── 3. Check uniqueness in registry DB (slug, db_name, and global admin_email) ──
    const registryConn = await getRegistryConnection();
    const Tenant = registryConn.model('Tenant', tenantSchema);

    // Check if Parivar name/slug already exists
    const existingName = await Tenant.findOne({ $or: [{ slug }, { db_name }] });
    if (existingName) {
      return apiResponse(
        res, 409,
        `A Parivar with the name "${existingName.parivar_name}" already exists. Please choose a different name.`
      );
    }

    // Check if Admin Email is already used across any Parivar
    const existingEmail = await Tenant.findOne({ "admin.email": admin_email.toLowerCase() });
    if (existingEmail) {
      return apiResponse(
        res, 409,
        `Admin email "${admin_email}" is already registered with "${existingEmail.parivar_name}". Each Parivar must have a unique admin email.`
      );
    }

    // ── 4. Create tenant record in registry ──
    const tenant = new Tenant({
      parivar_name,
      slug,
      db_name,
      admin: {
        first_name: admin_first_name,
        last_name:  admin_last_name,
        email:      admin_email.toLowerCase(),
        mobile:     admin_mobile,
      },
    });
    await tenant.save();

    // ── 5. Connect to tenant DB and seed the admin user ──
    const tenantConn = await getTenantConnection(db_name);

    // Load the User schema into the tenant connection
    const mongoose = require('mongoose');
    // We need the raw schema
    const userSchema = userSchemaRaw.schema;
    const TenantUser = tenantConn.models.User || tenantConn.model('User', userSchema);

    const adminUser = new TenantUser({
      member_id:    '1',
      first_name:   admin_first_name,
      last_name:    admin_last_name,
      email:        admin_email.toLowerCase(),
      password:     admin_password, // Pre-save hook will hash this
      number:       admin_mobile,
      is_committee: true,
      committee_role: 'Admin',
      relation:     'Self',
      status:       1,
      family_head:  { id: null, name: `${admin_first_name} ${admin_last_name}`.trim() },
    });

    await adminUser.save();

    // Mark tenant as seeded
    tenant.seeded_at = new Date();
    await tenant.save();

    // ── 6. Respond ──
    return apiResponse(res, 201, 'Parivar registered successfully!', {
      tenant: {
        _id:          tenant._id,
        parivar_name: tenant.parivar_name,
        slug:         tenant.slug,
        db_name:      tenant.db_name,
        plan:         tenant.plan,
        status:       tenant.status,
        created_at:   tenant.createdAt,
      },
      admin: {
        _id:        adminUser._id,
        first_name: adminUser.first_name,
        last_name:  adminUser.last_name,
        email:      adminUser.email,
        mobile:     adminUser.number,
        member_id:  adminUser.member_id,
      },
    });

  } catch (error) {
    console.error('[registerParivar] Error:', error.message);
    return apiResponse(res, 500, 'Error registering Parivar', { error: error.message });
  }
};

/**
 * GET /api/register-parivar
 * Returns list of all registered Parivars from the registry DB (no sensitive data).
 */
const getAllParivars = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const registryConn = await getRegistryConnection();
    const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', tenantSchema);

    const query = search
      ? { parivar_name: new RegExp(search, 'i') }
      : {};

    const [tenants, total] = await Promise.all([
      Tenant.find(query, '-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Tenant.countDocuments(query),
    ]);

    return apiResponse(res, 200, 'Parivars fetched successfully', tenants, {
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error fetching Parivars', { error: error.message });
  }
};

/**
 * PUT /api/register-parivar/:id
 * Updates Parivar details in registry and admin details in both registry and tenant DB.
 */
const updateParivar = async (req, res) => {
  try {
    const { id } = req.params;
    const { parivar_name, status, admin_first_name, admin_last_name, admin_mobile } = req.body;

    const registryConn = await getRegistryConnection();
    const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', tenantSchema);

    const tenant = await Tenant.findById(id);
    if (!tenant) return apiResponse(res, 404, 'Parivar not found');

    if (parivar_name) tenant.parivar_name = parivar_name;
    if (status !== undefined) tenant.status = Number(status);
    if (admin_first_name) tenant.admin.first_name = admin_first_name;
    if (admin_last_name !== undefined) tenant.admin.last_name = admin_last_name;
    if (admin_mobile) tenant.admin.mobile = admin_mobile;

    await tenant.save();

    // Try to update admin details in tenant DB as well
    if (admin_first_name || admin_last_name !== undefined || admin_mobile) {
      try {
        const tenantConn = await getTenantConnection(tenant.db_name);
        const userSchemaRaw = require('../models/userModels');
        const userSchema = userSchemaRaw.schema;
        const TenantUser = tenantConn.models.User || tenantConn.model('User', userSchema);
        
        const adminUser = await TenantUser.findOne({ email: tenant.admin.email });
        if (adminUser) {
          if (admin_first_name) adminUser.first_name = admin_first_name;
          if (admin_last_name !== undefined) adminUser.last_name = admin_last_name;
          if (admin_mobile) adminUser.number = admin_mobile;
          await adminUser.save();
        }
      } catch (e) {
        console.error('Failed to sync admin details to tenant DB', e);
      }
    }

    return apiResponse(res, 200, 'Parivar updated successfully', tenant);
  } catch (error) {
    return apiResponse(res, 500, 'Error updating Parivar', { error: error.message });
  }
};

/**
 * PUT /api/register-parivar/:id/password
 * Updates the admin password in the tenant DB.
 */
const updateParivarPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) return apiResponse(res, 400, 'new_password is required');

    const registryConn = await getRegistryConnection();
    const Tenant = registryConn.models.Tenant || registryConn.model('Tenant', tenantSchema);

    const tenant = await Tenant.findById(id);
    if (!tenant) return apiResponse(res, 404, 'Parivar not found');

    const tenantConn = await getTenantConnection(tenant.db_name);
    const userSchemaRaw = require('../models/userModels');
    const userSchema = userSchemaRaw.schema;
    const TenantUser = tenantConn.models.User || tenantConn.model('User', userSchema);
    
    let adminUser = await TenantUser.findOne({ email: tenant.admin.email });

    if (!adminUser) {
      // The admin was not seeded due to a previous crash during creation.
      // Seed it now.
      adminUser = new TenantUser({
        member_id:    '1',
        first_name:   tenant.admin.first_name,
        last_name:    tenant.admin.last_name,
        email:        tenant.admin.email,
        password:     new_password, // Pre-save hook will hash this
        number:       tenant.admin.mobile,
        is_committee: true,
        committee_role: 'Admin',
        relation:     'Self',
        status:       1,
        family_head:  { id: null, name: `${tenant.admin.first_name} ${tenant.admin.last_name}`.trim() },
      });
      await adminUser.save();
      
      // Update seeded_at in registry
      tenant.seeded_at = new Date();
      await tenant.save();
    } else {
      adminUser.password = new_password; // Pre-save hook will hash this
      await adminUser.save();
    }

    return apiResponse(res, 200, 'Admin password updated successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error updating password', { error: error.message });
  }
};

/**
 * POST /api/register-parivar/superadmin-login
 * Body: { email, password }
 * Default credentials: superadmin@gmail.com / admin@gmail
 */
const loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return apiResponse(res, 400, 'Email and password are required');
    }

    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@gmail.com';
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'admin@123';

    if (email.trim().toLowerCase() === SUPERADMIN_EMAIL.toLowerCase() && password === SUPERADMIN_PASSWORD) {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { role: 'superadmin', email: SUPERADMIN_EMAIL },
        process.env.JWT_SECRET || 'supersecretfamilykey',
        { expiresIn: '7d' }
      );

      return apiResponse(res, 200, 'Superadmin login successful', {
        token,
        user: {
          email: SUPERADMIN_EMAIL,
          role: 'superadmin',
          name: 'Super Administrator'
        }
      });
    }

    return apiResponse(res, 401, 'Invalid Super Admin credentials');
  } catch (error) {
    return apiResponse(res, 500, 'Superadmin login error', { error: error.message });
  }
};

module.exports = { registerParivar, getAllParivars, updateParivar, updateParivarPassword, loginSuperAdmin };
