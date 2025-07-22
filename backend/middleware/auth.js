const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Optional auth middleware - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

// Check if user is an artist
const isArtist = (req, res, next) => {
  if (req.user.role !== 'artist' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Artist role required.' });
  }
  next();
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

// Check if user owns the resource or is admin
const isOwnerOrAdmin = (resourceOwnerField = 'user') => {
  return (req, res, next) => {
    if (req.user.role === 'admin') {
      return next();
    }
    
    // The resource should be attached to req by previous middleware
    if (req.resource && req.resource[resourceOwnerField]) {
      if (req.resource[resourceOwnerField].toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied. Not authorized.' });
      }
    }
    
    next();
  };
};

module.exports = {
  auth,
  optionalAuth,
  isArtist,
  isAdmin,
  isOwnerOrAdmin
};
