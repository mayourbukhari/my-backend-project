const express = require('express');
const { body, param, query } = require('express-validator');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getVirtualTours,
  getVirtualTour,
  createVirtualTour,
  updateVirtualTour,
  deleteVirtualTour,
  uploadTourAssets,
  getPopularTours,
  getTourAnalytics,
  toggleLikeTour
} = require('../controllers/virtualTourController');

const router = express.Router();

// Validation rules
const createTourValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('type')
    .isIn(['gallery', 'studio', 'timeline', 'exhibition'])
    .withMessage('Invalid tour type'),
  body('settings.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Each tag must be between 2 and 30 characters')
];

const updateTourValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('type')
    .optional()
    .isIn(['gallery', 'studio', 'timeline', 'exhibition'])
    .withMessage('Invalid tour type'),
  body('settings.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items')
];

const mongoIdValidation = [
  param('id').isMongoId().withMessage('Invalid tour ID')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('type')
    .optional()
    .isIn(['gallery', 'studio', 'timeline', 'exhibition'])
    .withMessage('Invalid tour type'),
  query('artist')
    .optional()
    .isMongoId()
    .withMessage('Invalid artist ID'),
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  query('sort')
    .optional()
    .isIn(['-createdAt', 'createdAt', '-views', 'views', '-likes', 'likes', 'title', '-title'])
    .withMessage('Invalid sort option')
];

// Public routes
router.get('/popular', getPopularTours);
router.get('/', queryValidation, getVirtualTours);
router.get('/:id', mongoIdValidation, getVirtualTour);

// Protected routes (require authentication)
router.use(auth); // Apply auth middleware to all routes below

// Tour management
router.post('/', createTourValidation, createVirtualTour);
router.put('/:id', [...mongoIdValidation, ...updateTourValidation], updateVirtualTour);
router.delete('/:id', mongoIdValidation, deleteVirtualTour);

// Asset upload
router.post(
  '/:id/upload-assets',
  mongoIdValidation,
  upload.array('assets', 10), // Allow up to 10 files
  uploadTourAssets
);

// Analytics and interactions
router.get('/:id/analytics', mongoIdValidation, getTourAnalytics);
router.post('/:id/like', mongoIdValidation, toggleLikeTour);

module.exports = router;
