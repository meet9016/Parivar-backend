const express = require('express');
const router = express.Router();
const { registerParivar, getAllParivars, updateParivar, updateParivarPassword, loginSuperAdmin } = require('../controllers/tenantController');
 
/**
 * POST /api/register-parivar/superadmin-login
 * Authenticates the Super Admin user.
 */
router.post('/superadmin-login', loginSuperAdmin);

/**
 * POST /api/register-parivar
 * Public endpoint — anyone can register a new Parivar community.
 * Creates: tenant record in registry DB + admin user in the tenant DB.
 */
router.post('/', registerParivar);

/**
 * GET /api/register-parivar
 * Superadmin portal: Returns all registered Parivars from the central registry.
 */
router.get('/', getAllParivars);

/**
 * PUT /api/register-parivar/:id
 * Updates parivar details.
 */
router.put('/:id', updateParivar);

/**
 * PUT /api/register-parivar/:id/password
 * Updates the admin password for a parivar.
 */
router.put('/:id/password', updateParivarPassword);

module.exports = router;
