const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const {
  createCommission,
  getCommissions,
  getCommissionById,
  updateCommissionStatus,
  addMessage,
  submitQuote,
  acceptQuote,
  uploadProgress,
  completeMilestone,
  getCommissionStats
} = require('../controllers/commissionController');

// Validation middleware
const validateCommission = [
  body('artistId').isMongoId().withMessage('Valid artist ID is required'),
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
  body('description').trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be 20-2000 characters'),
  body('budget.min').isFloat({ min: 1 }).withMessage('Minimum budget must be at least $1'),
  body('budget.max').isFloat({ min: 1 }).withMessage('Maximum budget must be at least $1'),
  body('budget.max').custom((value, { req }) => {
    if (value < req.body.budget.min) {
      throw new Error('Maximum budget must be greater than minimum budget');
    }
    return true;
  })
];

const validateQuote = [
  body('proposedPrice').isFloat({ min: 1 }).withMessage('Proposed price must be at least $1'),
  body('timeline.estimatedDays').optional().isInt({ min: 1 }).withMessage('Estimated days must be at least 1'),
  body('terms').optional().trim().isLength({ max: 5000 }).withMessage('Terms must be less than 5000 characters')
];

const validateMessage = [
  body('message').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters'),
  body('type').optional().isIn(['message', 'quote', 'revision_request', 'approval', 'delivery'])
];

const validateProgress = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('images').isArray({ min: 1 }).withMessage('At least one image is required')
];

// Routes

// GET /api/commissions - Get all commissions for user
router.get('/', auth, getCommissions);

// GET /api/commissions/stats - Get commission statistics
router.get('/stats', auth, getCommissionStats);

// POST /api/commissions - Create new commission
router.post('/', auth, validateCommission, createCommission);

// GET /api/commissions/:id - Get commission by ID
router.get('/:id', auth, getCommissionById);

// PUT /api/commissions/:id/status - Update commission status
router.put('/:id/status', auth, updateCommissionStatus);

// POST /api/commissions/:id/messages - Add message to commission
router.post('/:id/messages', auth, validateMessage, addMessage);

// POST /api/commissions/:id/quote - Submit quote (artist only)
router.post('/:id/quote', auth, validateQuote, submitQuote);

// POST /api/commissions/:id/accept - Accept quote (client only)
router.post('/:id/accept', auth, acceptQuote);

// POST /api/commissions/:id/progress - Upload work in progress (artist only)
router.post('/:id/progress', auth, validateProgress, uploadProgress);

// PUT /api/commissions/:id/milestones/:milestoneIndex/complete - Complete milestone
router.put('/:id/milestones/:milestoneIndex/complete', auth, completeMilestone);

module.exports = router;
