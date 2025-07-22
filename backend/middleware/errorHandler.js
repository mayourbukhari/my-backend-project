// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = new AppError(message, 400);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    error = new AppError(message, 400);
  }

  // Cloudinary errors
  if (err.http_code) {
    const message = err.message || 'Cloudinary upload error';
    error = new AppError(message, err.http_code);
  }

  // Payment errors (Stripe/Razorpay)
  if (err.type && err.type.includes('Stripe')) {
    const message = err.message || 'Payment processing error';
    error = new AppError(message, 400);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      error: err,
      stack: err.stack
    })
  });
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

// Database error handler
const handleDatabaseError = (err, req, res, next) => {
  if (err.name === 'MongoNetworkError') {
    return res.status(503).json({
      success: false,
      message: 'Database connection error. Please try again later.'
    });
  }

  if (err.name === 'MongoTimeoutError') {
    return res.status(504).json({
      success: false,
      message: 'Database operation timed out. Please try again.'
    });
  }

  next(err);
};

// Rate limit error handler
const handleRateLimitError = (req, res, next) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests from this IP, please try again after some time.',
    retryAfter: req.rateLimit.resetTime
  });
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFound,
  handleDatabaseError,
  handleRateLimitError
};
