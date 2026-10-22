/**
 * Authentication and JWT Configuration
 * Token Expiration is set to 3 days ('3d')
 */
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfamilykey';
const JWT_EXPIRES_IN = '3d'; // 3 days validity (72 hours)

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
