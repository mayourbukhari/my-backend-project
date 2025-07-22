const { body, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('role')
    .optional()
    .isIn(['user', 'artist'])
    .withMessage('Role must be either user or artist'),
  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
  body('profile.firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('profile.lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('profile.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('profile.location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  handleValidationErrors
];

// Artwork validation
const validateArtwork = [
  body('title')
    .trim()
    .notEmpty()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description is required and must be between 10 and 2000 characters'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .isIn([
      'painting', 'sculpture', 'photography', 'drawing', 'printmaking',
      'digital', 'mixed-media', 'textile', 'ceramics', 'jewelry', 'other'
    ])
    .withMessage('Please select a valid category'),
  body('medium')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Medium must be less than 100 characters'),
  body('style')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Style must be less than 100 characters'),
  body('dimensions.width')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Width must be a positive number'),
  body('dimensions.height')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Height must be a positive number'),
  body('dimensions.depth')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Depth must be a positive number'),
  body('yearCreated')
    .optional()
    .isInt({ min: 1000, max: new Date().getFullYear() })
    .withMessage('Year created must be a valid year'),
  handleValidationErrors
];

// Order validation
const validateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.artwork')
    .isMongoId()
    .withMessage('Invalid artwork ID'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('shippingAddress.firstName')
    .trim()
    .notEmpty()
    .withMessage('Shipping first name is required'),
  body('shippingAddress.lastName')
    .trim()
    .notEmpty()
    .withMessage('Shipping last name is required'),
  body('shippingAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Shipping street address is required'),
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('Shipping city is required'),
  body('shippingAddress.zipCode')
    .trim()
    .notEmpty()
    .withMessage('Shipping zip code is required'),
  body('shippingAddress.country')
    .trim()
    .notEmpty()
    .withMessage('Shipping country is required'),
  handleValidationErrors
];

// Artist profile validation
const validateArtistProfile = [
  body('artistProfile.name')
    .trim()
    .notEmpty()
    .isLength({ min: 1, max: 100 })
    .withMessage('Artist name is required and must be less than 100 characters'),
  body('artistProfile.bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must be less than 1000 characters'),
  body('artistProfile.statement')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Artist statement must be less than 2000 characters'),
  body('artistProfile.website')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL'),
  body('artistProfile.socialLinks.instagram')
    .optional()
    .isURL()
    .withMessage('Instagram link must be a valid URL'),
  body('artistProfile.socialLinks.facebook')
    .optional()
    .isURL()
    .withMessage('Facebook link must be a valid URL'),
  body('artistProfile.socialLinks.twitter')
    .optional()
    .isURL()
    .withMessage('Twitter link must be a valid URL'),
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validateArtwork,
  validateOrder,
  validateArtistProfile,
  handleValidationErrors
};
