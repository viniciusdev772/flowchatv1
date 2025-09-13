const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrf');
const securityMiddleware = require('../middleware/security');

const router = express.Router();

/**
 * @fileoverview This file defines the authentication routes for the application.
 * @module routes/auth
 */

/**
 * @description Applies security middleware to all auth routes.
 */
router.use(securityMiddleware.fullSecurityStack());

/**
 * @description Route to get a CSRF token.
 * @name GET /auth/csrf-token
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.get('/csrf-token', csrfProtection.addTokenToResponse());

/**
 * @description Route to register a new user.
 * @name POST /auth/register
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {string} path - Express path
 * @param {callback[]} middleware - Express middlewares.
 * @param {callback} middleware - Express middleware.
 */
router.post('/register', [
  csrfProtection.verifyAuthToken(),
  securityMiddleware.validateRegistration(),
  securityMiddleware.checkValidationResults(),
  csrfProtection.refreshToken()
], authController.register);

/**
 * @description Route to log in a user.
 * @name POST /auth/login
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {string} path - Express path
 * @param {callback[]} middleware - Express middlewares.
 * @param {callback} middleware - Express middleware.
 */
router.post('/login', [
  csrfProtection.verifyAuthToken(),
  securityMiddleware.validateLogin(),
  securityMiddleware.checkValidationResults(),
  csrfProtection.refreshToken()
], authController.login);

/**
 * @description Route to get the current user's profile.
 * @name GET /auth/profile
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @param {callback} middleware - Express middleware.
 */
router.get('/profile',
  authenticateToken,
  authController.getProfile
);

/**
 * @description Route to update the current user's profile.
 * @name PUT /auth/profile
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {string} path - Express path
 * @param {callback[]} middleware - Express middlewares.
 * @param {callback} middleware - Express middleware.
 */
router.put('/profile', [
  authenticateToken,
  csrfProtection.verifyToken()
], authController.updateProfile);

/**
 * @description Route to change the current user's password.
 * @name POST /auth/change-password
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {string} path - Express path
 * @param {callback[]} middleware - Express middlewares.
 * @param {callback} middleware - Express middleware.
 */
router.post('/change-password', [
  authenticateToken,
  csrfProtection.verifyToken()
], authController.changePassword);

/**
 * @description Route to log out the current user.
 * @name POST /auth/logout
 * @function
 * @memberof module:routes/auth
 * @inner
 * @param {string} path - Express path
 * @param {callback[]} middleware - Express middlewares.
 * @param {callback} middleware - Express middleware.
 */
router.post('/logout', [
  csrfProtection.clearSession()
], authController.logout);

module.exports = router;