const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const {
  getMentorshipPrograms,
  getMentorshipById,
  createMentorshipProgram,
  applyForMentorship,
  updateApplicationStatus,
  getUserMentorships,
  addSession,
  completeSession,
  addReview
} = require('../controllers/mentorshipController');

// Validation rules
const createProgramValidation = [
  body('program.title')
    .notEmpty()
    .withMessage('Program title is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('program.description')
    .notEmpty()
    .withMessage('Program description is required')
    .isLength({ min: 20, max: 1000 })
    .withMessage('Description must be between 20 and 1000 characters'),
  body('program.duration')
    .isInt({ min: 1, max: 52 })
    .withMessage('Duration must be between 1 and 52 weeks'),
  body('program.price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('program.level')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid level'),
  body('program.format')
    .isIn(['one-on-one', 'group', 'workshop', 'online', 'in-person', 'hybrid'])
    .withMessage('Invalid format'),
  body('program.categories')
    .isArray({ min: 1 })
    .withMessage('At least one category is required')
];

const applyValidation = [
  body('message')
    .notEmpty()
    .withMessage('Application message is required')
    .isLength({ min: 50, max: 1000 })
    .withMessage('Message must be between 50 and 1000 characters'),
  body('experience')
    .isIn(['beginner', 'some-experience', 'intermediate', 'advanced'])
    .withMessage('Invalid experience level')
];

const sessionValidation = [
  body('scheduledDate')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('duration')
    .optional()
    .isInt({ min: 30, max: 180 })
    .withMessage('Duration must be between 30 and 180 minutes')
];

const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment must not exceed 500 characters')
];

// Public routes
router.get('/', getMentorshipPrograms);
router.get('/:id', getMentorshipById);

// Protected routes
router.use(auth);

// Mentor routes
router.post('/', createProgramValidation, createMentorshipProgram);
router.put('/applications/:applicationId/status', updateApplicationStatus);

// Mentee routes
router.post('/:mentorshipId/apply', applyValidation, applyForMentorship);

// Shared routes (mentor and mentee)
router.get('/user/my-mentorships', getUserMentorships);
router.post('/:mentorshipId/sessions', sessionValidation, addSession);
router.put('/:mentorshipId/sessions/:sessionId/complete', completeSession);
router.post('/:mentorshipId/reviews', reviewValidation, addReview);

module.exports = router;
