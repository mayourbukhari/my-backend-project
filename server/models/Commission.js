const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    style: String,
    medium: String,
    dimensions: {
      width: Number,
      height: Number,
      depth: Number,
      unit: {
        type: String,
        enum: ['inches', 'cm', 'feet', 'm'],
        default: 'inches'
      }
    },
    colorPreferences: [String],
    themes: [String],
    referenceImages: [String],
    deadline: Date
  },
  budget: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  proposedPrice: {
    type: Number
  },
  agreedPrice: {
    type: Number
  },
  status: {
    type: String,
    enum: [
      'pending',     // Initial request
      'reviewing',   // Artist reviewing
      'quoted',      // Artist provided quote
      'negotiating', // Price negotiation
      'accepted',    // Client accepted quote
      'in_progress', // Work started
      'review',      // Client reviewing work
      'revision',    // Needs changes
      'completed',   // Work completed
      'delivered',   // Final delivery
      'cancelled',   // Cancelled
      'rejected'     // Artist/client rejected
    ],
    default: 'pending'
  },
  timeline: {
    estimatedDays: Number,
    startDate: Date,
    expectedCompletion: Date,
    actualCompletion: Date
  },
  milestones: [{
    title: String,
    description: String,
    dueDate: Date,
    completed: {
      type: Boolean,
      default: false
    },
    completedDate: Date,
    paymentPercentage: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  communication: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true
    },
    attachments: [String],
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['message', 'quote', 'revision_request', 'approval', 'delivery'],
      default: 'message'
    }
  }],
  workInProgress: [{
    title: String,
    description: String,
    images: [String],
    uploadDate: {
      type: Date,
      default: Date.now
    },
    approved: Boolean,
    feedback: String
  }],
  finalDelivery: {
    images: [String],
    description: String,
    deliveryDate: Date,
    approved: Boolean,
    approvalDate: Date
  },
  payment: {
    totalAmount: Number,
    paidAmount: {
      type: Number,
      default: 0
    },
    paymentSchedule: [{
      amount: Number,
      dueDate: Date,
      paid: {
        type: Boolean,
        default: false
      },
      paidDate: Date,
      razorpayOrderId: String,
      razorpayPaymentId: String
    }],
    razorpayAccountId: String,
    platformFee: {
      type: Number,
      default: 0.1 // 10% platform fee
    }
  },
  contract: {
    terms: String,
    agreedDate: Date,
    clientSignature: String,
    artistSignature: String,
    witnessSignature: String
  },
  reviews: {
    clientReview: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      date: Date
    },
    artistReview: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      date: Date
    }
  },
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    tags: [String],
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
commissionSchema.index({ client: 1, status: 1 });
commissionSchema.index({ artist: 1, status: 1 });
commissionSchema.index({ status: 1, 'metadata.createdAt': -1 });
commissionSchema.index({ 'requirements.deadline': 1 });

// Virtual for commission URL
commissionSchema.virtual('url').get(function() {
  return `/commission/${this._id}`;
});

// Pre-save middleware to update timestamps
commissionSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Methods
commissionSchema.methods.addMessage = function(senderId, message, attachments = [], type = 'message') {
  this.communication.push({
    sender: senderId,
    message,
    attachments,
    type,
    timestamp: new Date()
  });
  return this.save();
};

commissionSchema.methods.updateStatus = function(newStatus, updatedBy) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Add status change message
  this.communication.push({
    sender: updatedBy,
    message: `Status changed from "${oldStatus}" to "${newStatus}"`,
    type: 'message',
    timestamp: new Date()
  });
  
  return this.save();
};

commissionSchema.methods.calculateProgress = function() {
  const totalMilestones = this.milestones.length;
  if (totalMilestones === 0) return 0;
  
  const completedMilestones = this.milestones.filter(m => m.completed).length;
  return Math.round((completedMilestones / totalMilestones) * 100);
};

commissionSchema.methods.getNextPaymentDue = function() {
  const unpaidPayments = this.payment.paymentSchedule.filter(p => !p.paid);
  if (unpaidPayments.length === 0) return null;
  
  return unpaidPayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
};

// Static methods
commissionSchema.statics.getCommissionsByStatus = function(status) {
  return this.find({ status }).populate('client artist', 'profile email');
};

commissionSchema.statics.getUpcomingDeadlines = function(days = 7) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  
  return this.find({
    'requirements.deadline': { $lte: deadline },
    status: { $in: ['accepted', 'in_progress'] }
  }).populate('client artist', 'profile email');
};

module.exports = mongoose.model('Commission', commissionSchema);
