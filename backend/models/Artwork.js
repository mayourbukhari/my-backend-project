const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  images: [{
    url: String,
    publicId: String, // Cloudinary public ID
    isMain: Boolean
  }],
  price: {
    type: Number,
    required: function() {
      return this.availability === 'available';
    },
    min: 0,
    default: 0
  },
  originalPrice: Number, // For sale pricing
  currency: {
    type: String,
    default: 'USD'
  },
  category: {
    type: String,
    required: true,
    enum: [
      'painting',
      'sculpture',
      'photography',
      'drawing',
      'printmaking',
      'digital',
      'mixed-media',
      'textile',
      'ceramics',
      'jewelry',
      'other'
    ]
  },
  medium: String, // e.g., 'Oil on canvas', 'Acrylic', 'Watercolor'
  style: String, // e.g., 'Abstract', 'Realistic', 'Contemporary'
  dimensions: {
    width: Number,
    height: Number,
    depth: Number,
    unit: {
      type: String,
      enum: ['cm', 'in', 'mm'],
      default: 'cm'
    }
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['kg', 'lb', 'g'],
      default: 'kg'
    }
  },
  yearCreated: Number,
  isOriginal: {
    type: Boolean,
    default: true
  },
  edition: {
    current: Number,
    total: Number
  },
  availability: {
    type: String,
    enum: ['available', 'sold', 'reserved', 'not-for-sale'],
    default: 'available'
  },
  isCommissionable: {
    type: Boolean,
    default: false
  },
  isFramed: Boolean,
  frameIncluded: Boolean,
  tags: [String],
  colors: [String], // Dominant colors for filtering
  materials: [String],
  techniques: [String],
  condition: {
    type: String,
    enum: ['excellent', 'very-good', 'good', 'fair'],
    default: 'excellent'
  },
  provenance: String,
  certificate: {
    hasAuthenticity: Boolean,
    issuer: String,
    dateIssued: Date
  },
  shipping: {
    included: Boolean,
    cost: Number,
    international: Boolean,
    handlingTime: Number // Days
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  featured: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  seoTitle: String,
  seoDescription: String,
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  }
}, {
  timestamps: true
});

// Indexes for better search performance
artworkSchema.index({ title: 'text', description: 'text', tags: 'text' });
artworkSchema.index({ artist: 1 });
artworkSchema.index({ category: 1 });
artworkSchema.index({ price: 1 });
artworkSchema.index({ availability: 1 });
artworkSchema.index({ featured: -1, createdAt: -1 });

// Virtual for like count
artworkSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Method to check if user liked this artwork
artworkSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to increment views
artworkSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('Artwork', artworkSchema);
