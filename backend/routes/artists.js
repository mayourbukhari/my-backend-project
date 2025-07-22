const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artistController');
const { auth, isArtist, isAdmin } = require('../middleware/auth');
const { validateArtistProfile } = require('../middleware/validation');

// Public routes
router.get('/', artistController.getArtists);
router.get('/:id', artistController.getArtistById);

// Protected routes - require authentication
router.post('/:id/follow', auth, artistController.toggleFollowArtist);

// Artist only routes
router.put('/profile', auth, isArtist, validateArtistProfile, artistController.updateArtistProfile);
router.post('/verify', auth, isArtist, artistController.requestVerification);
router.get('/dashboard/stats', auth, isArtist, artistController.getArtistStats);

// Admin only routes
router.put('/:id/verification', auth, isAdmin, artistController.updateVerificationStatus);

module.exports = router;
