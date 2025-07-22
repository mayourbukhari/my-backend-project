const mongoose = require('mongoose');

const mentorshipSchema = new mongoose.Schema({
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mentee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  program: {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    duration: {
      type: Number, // Duration in weeks
      required: true,
      min: 1,
      max: 52
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    maxMentees: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    categories: [{
      type: String,
      enum: [
        'painting',
        'sculpture',
        'photography',
        'digital-art',
        'drawing',
        'mixed-media',
        'business',
        'marketing',
        'portfolio-development',
        'art-history',
        'critique',
        'technique'
      ]
    }],
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true
    },
    format: {
      type: String,
      enum: ['one-on-one', 'group', 'workshop', 'online', 'in-person', 'hybrid'],
      required: true
    },
    schedule: {
      frequency: {
        type: String,
        enum: ['weekly', 'bi-weekly', 'monthly'],
        default: 'weekly'
      },
      duration: {
        type: Number, // Session duration in minutes
        default: 60,
        min: 30,
        max: 180
      },
      timeSlots: [{
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        startTime: String, // Format: "HH:MM"
        endTime: String    // Format: "HH:MM"
      }],
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  application: {
    message: {
      type: String,
      required: true
    },
    portfolio: [{
      title: String,
      description: String,
      imageUrl: String,
      category: String
    }],
    experience: {
      type: String,
      enum: ['beginner', 'some-experience', 'intermediate', 'advanced']
    },
    goals: [String],
    availableSlots: [{
      day: String,
      startTime: String,
      endTime: String
    }],
    appliedAt: {
      type: Date,
      default: Date.now
    }
  },
  sessions: [{
    scheduledDate: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      default: 60
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled'
    },
    agenda: String,
    homework: String,
    feedback: {
      mentorFeedback: String,
      menteeFeedback: String,
      mentorRating: {
        type: Number,
        min: 1,
        max: 5
      },
      menteeRating: {
        type: Number,
        min: 1,
        max: 5
      }
    },
    resources: [{
      title: String,
      description: String,
      type: {
        type: String,
        enum: ['document', 'video', 'link', 'book', 'article']
      },
      url: String
    }],
    completedAt: Date
  }],
  progress: {
    completedSessions: {
      type: Number,
      default: 0
    },
    totalSessions: {
      type: Number,
      required: true
    },
    milestones: [{
      title: String,
      description: String,
      targetDate: Date,
      completedDate: Date,
      status: {
        type: String,
        enum: ['pending', 'completed', 'overdue'],
        default: 'pending'
      }
    }],
    skills: [{
      name: String,
      level: {
        type: Number,
        min: 1,
        max: 10
      },
      assessedAt: Date
    }]
  },
  payment: {
    totalAmount: {
      type: Number,
      required: true
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    paymentPlan: {
      type: String,
      enum: ['full', 'installments'],
      default: 'full'
    },
    installments: [{
      amount: Number,
      dueDate: Date,
      paidDate: Date,
      status: {
        type: String,
        enum: ['pending', 'paid', 'overdue'],
        default: 'pending'
      }
    }],
    razorpayOrderId: String,
    razorpayPaymentId: String
  },
  communication: {
    preferredMethod: {
      type: String,
      enum: ['email', 'video-call', 'chat', 'phone'],
      default: 'video-call'
    },
    lastContact: Date,
    notes: [{
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      isPrivate: {
        type: Boolean,
        default: false
      }
    }]
  },
  reviews: {
    mentorReview: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      createdAt: Date
    },
    menteeReview: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      createdAt: Date
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
mentorshipSchema.index({ mentor: 1, status: 1 });
mentorshipSchema.index({ mentee: 1, status: 1 });
mentorshipSchema.index({ 'program.categories': 1, status: 1 });
mentorshipSchema.index({ 'program.level': 1, 'program.format': 1 });
mentorshipSchema.index({ createdAt: -1 });

// Virtual for progress percentage
mentorshipSchema.virtual('progressPercentage').get(function() {
  if (this.progress.totalSessions === 0) return 0;
  return Math.round((this.progress.completedSessions / this.progress.totalSessions) * 100);
});

// Virtual for average rating
mentorshipSchema.virtual('averageRating').get(function() {
  const ratings = [];
  if (this.reviews.mentorReview?.rating) ratings.push(this.reviews.mentorReview.rating);
  if (this.reviews.menteeReview?.rating) ratings.push(this.reviews.menteeReview.rating);
  
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
});

// Pre-save middleware to calculate total sessions
mentorshipSchema.pre('save', function(next) {
  if (this.isNew) {
    // Calculate total sessions based on duration and frequency
    const { duration, schedule } = this.program;
    const sessionsPerWeek = schedule.frequency === 'weekly' ? 1 : 
                           schedule.frequency === 'bi-weekly' ? 0.5 : 
                           0.25; // monthly
    
    this.progress.totalSessions = Math.ceil(duration * sessionsPerWeek);
    this.payment.totalAmount = this.program.price;
  }
  next();
});

// Methods
mentorshipSchema.methods.canAcceptMoreMentees = function() {
  return this.program.maxMentees > 0; // This would need to be calculated differently in practice
};

mentorshipSchema.methods.addSession = function(sessionData) {
  this.sessions.push(sessionData);
  return this.save();
};

mentorshipSchema.methods.completeSession = function(sessionId, feedback) {
  const session = this.sessions.id(sessionId);
  if (session) {
    session.status = 'completed';
    session.completedAt = new Date();
    session.feedback = feedback;
    this.progress.completedSessions += 1;
    return this.save();
  }
  throw new Error('Session not found');
};

module.exports = mongoose.model('Mentorship', mentorshipSchema);
