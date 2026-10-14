const mongoose = require('mongoose');

/**
 * Determines the location scope restrictions for a given authenticated user.
 * 
 * Hierarchy handled:
 * 1. Super Admin / President / Admin -> Global (no location restrictions)
 * 2. State Pramukh (or state-level role) -> Restricted to user's state / state_id
 * 3. District Pramukh (or district-level role) -> Restricted to user's district / district_id
 * 4. City Pramukh (or city-level role) -> Restricted to user's city / city_id
 * 5. Village Pramukh (or committee with village / village-level role) -> Restricted to user's village / village_id
 * 
 * @param {Object} user - Normalized req.user object
 * @param {Object} conn - Active tenant mongoose connection
 * @returns {Promise<{
 *   isRestricted: boolean,
 *   scopeType: 'all' | 'state' | 'district' | 'city' | 'village',
 *   stateId?: string,
 *   stateName?: string,
 *   districtId?: string,
 *   districtName?: string,
 *   cityId?: string,
 *   cityName?: string,
 *   villageId?: string,
 *   villageName?: string,
 *   villageList?: string[], // All village names or IDs in this scope if resolved
 *   buildQueryClause: (modelType?: 'user' | 'registration' | 'dashboard') => Object
 * }>}
 */
const getUserRoleScope = async (user, conn) => {
  if (!user) {
    return {
      isRestricted: false,
      scopeType: 'all',
      buildQueryClause: () => ({})
    };
  }

  const roleName = String(
    user.role_name ||
    user.role_id?.name ||
    user.committee_role ||
    user.designation ||
    ''
  ).toLowerCase().trim();

  const isSuperAdmin = Boolean(
    user.role === 'superadmin' ||
    user.is_super_admin === true ||
    user.committee_role === 'President' ||
    roleName === 'admin' ||
    roleName === 'super admin' ||
    (!user.role_id && (user.role === 'admin' || user.committee_role === 'Admin'))
  );

  if (isSuperAdmin) {
    return {
      isRestricted: false,
      scopeType: 'all',
      buildQueryClause: () => ({})
    };
  }

  // Detect Scope Type by Role Name / Committee Role / Designation
  let scopeType = null;

  if (roleName.includes('state') || roleName.includes('rajya') || roleName.includes('state pramukh')) {
    scopeType = 'state';
  } else if (roleName.includes('district') || roleName.includes('jilla') || roleName.includes('zilla') || roleName.includes('district pramukh')) {
    scopeType = 'district';
  } else if (roleName.includes('city') || roleName.includes('shahar') || roleName.includes('city pramukh')) {
    scopeType = 'city';
  } else if (
    roleName.includes('village') ||
    roleName.includes('gam') ||
    roleName.includes('gaam') ||
    roleName.includes('village pramukh') ||
    roleName.includes('gam pramukh')
  ) {
    scopeType = 'village';
  } else if (user.is_committee || user.role === 'committee') {
    // Default fallback for committee:
    // If they have village set, default to village. If they only have district, district. If state, state.
    if (user.village || user.village_name || user.village_id) {
      scopeType = 'village';
    } else if (user.city || user.city_name || user.city_id) {
      scopeType = 'city';
    } else if (user.district || user.district_name || user.district_id) {
      scopeType = 'district';
    } else if (user.state || user.state_name || user.state_id) {
      scopeType = 'state';
    } else {
      return {
        isRestricted: false,
        scopeType: 'all',
        buildQueryClause: () => ({})
      };
    }
  } else {
    // Normal user or unrestricted role
    return {
      isRestricted: false,
      scopeType: 'all',
      buildQueryClause: () => ({})
    };
  }

  const escapeRegExp = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Pull assigned location data from user
  const stateId = String(user.state_id || '').trim();
  const stateName = String(user.state || user.state_name || '').trim();
  const districtId = String(user.district_id || '').trim();
  const districtName = String(user.district || user.district_name || '').trim();
  const cityId = String(user.city_id || '').trim();
  const cityName = String(user.city || user.city_name || '').trim();
  const villageId = String(user.village_id || '').trim();
  const villageName = String(user.village || user.village_name || '').trim();

  // Helper to construct Mongoose query clause
  const buildQueryClause = (modelType = 'user') => {
    const isRegistration = modelType === 'registration';

    if (scopeType === 'state') {
      const clauses = [];
      if (stateId) {
        clauses.push({ state_id: stateId });
        if (isRegistration) clauses.push({ 'step3.state_id': stateId });
      }
      if (stateName) {
        const sRegex = new RegExp(`^${escapeRegExp(stateName)}$`, 'i');
        clauses.push({ state: sRegex }, { state_name: sRegex });
        if (isRegistration) {
          clauses.push({ 'step3.state': sRegex }, { 'step3.state_name': sRegex });
        }
      }
      return clauses.length > 0 ? { $or: clauses } : {};
    }

    if (scopeType === 'district') {
      const clauses = [];
      if (districtId) {
        clauses.push({ district_id: districtId });
        if (isRegistration) clauses.push({ 'step3.district_id': districtId });
      }
      if (districtName) {
        const dRegex = new RegExp(`^${escapeRegExp(districtName)}$`, 'i');
        clauses.push({ district: dRegex }, { district_name: dRegex });
        if (isRegistration) {
          clauses.push({ 'step3.district': dRegex }, { 'step3.district_name': dRegex });
        }
      }
      return clauses.length > 0 ? { $or: clauses } : {};
    }

    if (scopeType === 'city') {
      const clauses = [];
      if (cityId) {
        clauses.push({ city_id: cityId });
        if (isRegistration) clauses.push({ 'step3.city_id': cityId });
      }
      if (cityName) {
        const cRegex = new RegExp(`^${escapeRegExp(cityName)}$`, 'i');
        clauses.push({ city: cRegex }, { city_name: cRegex });
        if (isRegistration) {
          clauses.push({ 'step3.city': cRegex }, { 'step3.city_name': cRegex });
        }
      }
      return clauses.length > 0 ? { $or: clauses } : {};
    }

    if (scopeType === 'village') {
      const clauses = [];
      const vTarget = villageName || villageId;
      if (vTarget) {
        const vRegex = new RegExp(`^${escapeRegExp(vTarget)}$`, 'i');
        clauses.push({ village: vRegex }, { village_name: vRegex }, { village: vTarget });
        if (isRegistration) {
          clauses.push(
            { 'step3.village': vRegex },
            { 'step3.village_name': vRegex },
            { 'step3.village': vTarget }
          );
        }
      }
      if (villageId) {
        clauses.push({ village_id: villageId });
        if (mongoose.isValidObjectId(villageId)) {
          clauses.push({ village: villageId });
        }
        if (isRegistration) {
          clauses.push({ 'step3.village_id': villageId });
        }
      }
      return clauses.length > 0 ? { $or: clauses } : {};
    }

    return {};
  };

  return {
    isRestricted: true,
    scopeType,
    stateId,
    stateName,
    districtId,
    districtName,
    cityId,
    cityName,
    villageId,
    villageName,
    buildQueryClause
  };
};

module.exports = {
  getUserRoleScope
};
