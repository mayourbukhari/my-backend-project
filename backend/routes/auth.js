const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validateProfileUpdate
} = require('../middleware/validation');

// Public routes
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, validateProfileUpdate, authController.updateProfile);
router.post('/change-password', auth, authController.changePassword);
router.post('/wishlist', auth, authController.addToWishlist);
router.delete('/wishlist/:artworkId', auth, authController.removeFromWishlist);

module.exports = router;
