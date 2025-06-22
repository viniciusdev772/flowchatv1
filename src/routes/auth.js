const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrf');
const securityMiddleware = require('../middleware/security');

const router = express.Router();

// Aplicar segurança geral a todas as rotas de auth
router.use(securityMiddleware.fullSecurityStack());

// Endpoint para obter token CSRF
router.get('/csrf-token', csrfProtection.addTokenToResponse());

// Public routes com segurança máxima
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

// Protected routes - profile otimizado (sem rate limit duplo)
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