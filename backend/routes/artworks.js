const express = require('express');
const router = express.Router();
const artworkController = require('../controllers/artworkController');
const { auth, optionalAuth, isArtist } = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/upload');
const { validateArtwork } = require('../middleware/validation');

// Public routes
router.get('/', optionalAuth, artworkController.getArtworks);
router.get('/debug', artworkController.debugArtworks); // Debug route
router.get('/:id', optionalAuth, artworkController.getArtworkById);
router.get('/:id/related', artworkController.getRelatedArtworks);

// Protected routes - require authentication
router.post('/:id/like', auth, artworkController.toggleLike);

// Artist only routes
router.post('/', 
  auth, 
  isArtist, 
  upload.array('artwork', 10), 
  handleMulterError,
  validateArtwork, 
  artworkController.createArtwork
);

router.put('/:id', 
  auth, 
  isArtist, 
  upload.array('artwork', 10), 
  handleMulterError,
  validateArtwork, 
  artworkController.updateArtwork
);

router.delete('/:id', auth, isArtist, artworkController.deleteArtwork);
router.delete('/:id/images/:imageId', auth, isArtist, artworkController.removeImage);
router.put('/:id/images/:imageId/main', auth, isArtist, artworkController.setMainImage);

module.exports = router;
