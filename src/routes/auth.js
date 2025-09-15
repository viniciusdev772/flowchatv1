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

router.use(securityMiddleware.fullSecurityStack());

/**
 * @swagger
 * /auth/csrf-token:
 *   get:
 *     summary: Get a CSRF token
 *     description: Retrieves a CSRF token to be used in subsequent requests.
 *     tags: [Auth]
 *     responses:
 *       '200':
 *         description: The CSRF token was retrieved successfully.
 */
router.get('/csrf-token', csrfProtection.addTokenToResponse());

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Registers a new user with the provided credentials.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '201':
 *         description: The user was registered successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 */
router.post('/register', [
  csrfProtection.verifyAuthToken(),
  securityMiddleware.validateRegistration(),
  securityMiddleware.checkValidationResults(),
  csrfProtection.refreshToken()
], authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     description: Logs in a user with the provided credentials.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The user was logged in successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, invalid credentials.
 */
router.post('/login', [
  csrfProtection.verifyAuthToken(),
  securityMiddleware.validateLogin(),
  securityMiddleware.checkValidationResults(),
  csrfProtection.refreshToken()
], authController.login);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieves the profile of the currently authenticated user.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: The user profile was retrieved successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 */
router.get('/profile',
  authenticateToken,
  authController.getProfile
);

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     description: Updates the profile of the currently authenticated user.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       '200':
 *         description: The user profile was updated successfully.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 */
router.put('/profile', [
  authenticateToken,
  csrfProtection.verifyToken()
], authController.updateProfile);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     description: Changes the password of the currently authenticated user.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       '200':
 *         description: The password was changed successfully.
 *       '400':
 *         description: Bad request, missing required parameters.
 *       '401':
 *         description: Unauthorized, user not authenticated.
 */
router.post('/change-password', [
  authenticateToken,
  csrfProtection.verifyToken()
], authController.changePassword);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out a user
 *     description: Logs out the currently authenticated user.
 *     tags: [Auth]
 *     responses:
 *       '200':
 *         description: The user was logged out successfully.
 */
router.post('/logout', [
  csrfProtection.clearSession()
], authController.logout);

module.exports = router;