const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrf');
const securityMiddleware = require('../middleware/security');

const router = express.Router();


router.use(securityMiddleware.fullSecurityStack());


router.get('/csrf-token', csrfProtection.addTokenToResponse());


router.post('/register', [
  csrfProtection.verifyAuthToken(),
  securityMiddleware.validateRegistration(),
  securityMiddleware.checkValidationResults(),
  csrfProtection.refreshToken()
], authController.register);

router.post('/login', [
  csrfProtection.verifyAuthToken(),
  securityMiddleware.validateLogin(),
  securityMiddleware.checkValidationResults(),
  csrfProtection.refreshToken()
], authController.login);


router.get('/profile',
  authenticateToken,
  authController.getProfile
);

router.put('/profile', [
  authenticateToken,
  csrfProtection.verifyToken()
], authController.updateProfile);

router.post('/change-password', [
  authenticateToken,
  csrfProtection.verifyToken()
], authController.changePassword);

router.post('/logout', [
  csrfProtection.clearSession()
], authController.logout);

module.exports = router;