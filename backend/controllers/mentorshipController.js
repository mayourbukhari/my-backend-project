const Mentorship = require('../models/Mentorship');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all mentorship programs
const getMentorshipPrograms = async (req, res) => {
  try {
    const {
      category,
      level,
      format,
      priceMin,
      priceMax,
      search,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { status: 'active' };

    if (category && category !== 'all') {
      filter['program.categories'] = category;
    }

    if (level && level !== 'all') {
      filter['program.level'] = level;
    }

    if (format && format !== 'all') {
      filter['program.format'] = format;
    }

    if (priceMin || priceMax) {
      filter['program.price'] = {};
      if (priceMin) filter['program.price'].$gte = Number(priceMin);
      if (priceMax) filter['program.price'].$lte = Number(priceMax);
    }

    if (search) {
      filter.$or = [
        { 'program.title': { $regex: search, $options: 'i' } },
        { 'program.description': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const mentorships = await Mentorship.find(filter)
      .populate('mentor', 'profile.name profile.bio profile.avatar profile.specialties verificationStatus')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Mentorship.countDocuments(filter);

    res.json({
      mentorships,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      total,
      hasNext: page * limit < total,
      hasPrev: page > 1
    });
  } catch (error) {
    console.error('Error fetching mentorship programs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single mentorship program
const getMentorshipById = async (req, res) => {
  try {
    const mentorship = await Mentorship.findById(req.params.id)
      .populate('mentor', 'profile.name profile.bio profile.avatar profile.specialties verificationStatus profile.socialMedia')
      .populate('mentee', 'profile.name profile.avatar');

    if (!mentorship) {
      return res.status(404).json({ message: 'Mentorship program not found' });
    }

    res.json(mentorship);
  } catch (error) {
    console.error('Error fetching mentorship:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create mentorship program (for mentors)
const createMentorshipProgram = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const mentor = await User.findById(req.user.id);
    if (!mentor || mentor.role !== 'artist') {
      return res.status(403).json({ message: 'Only verified artists can create mentorship programs' });
    }

    const mentorshipData = {
      mentor: req.user.id,
      program: req.body.program,
      status: 'active'
    };

    const mentorship = new Mentorship(mentorshipData);
    await mentorship.save();

    await mentorship.populate('mentor', 'profile.name profile.bio profile.avatar profile.specialties verificationStatus');

    res.status(201).json(mentorship);
  } catch (error) {
    console.error('Error creating mentorship program:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Apply for mentorship (for mentees)
const applyForMentorship = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { mentorshipId } = req.params;
    const { message, portfolio, experience, goals, availableSlots } = req.body;

    // Check if mentorship program exists and is active
    const mentorshipProgram = await Mentorship.findById(mentorshipId);
    if (!mentorshipProgram || mentorshipProgram.status !== 'active') {
      return res.status(404).json({ message: 'Mentorship program not found or inactive' });
    }

    // Check if user already applied
    const existingApplication = await Mentorship.findOne({
      mentor: mentorshipProgram.mentor,
      mentee: req.user.id,
      status: { $in: ['pending', 'accepted', 'active'] }
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'You already have an active application or mentorship with this mentor' });
    }

    const application = new Mentorship({
      mentor: mentorshipProgram.mentor,
      mentee: req.user.id,
      program: mentorshipProgram.program,
      status: 'pending',
      application: {
        message,
        portfolio: portfolio || [],
        experience,
        goals: goals || [],
        availableSlots: availableSlots || []
      }
    });

    await application.save();
    await application.populate([
      { path: 'mentor', select: 'profile.name profile.email' },
      { path: 'mentee', select: 'profile.name profile.email' }
    ]);

    res.status(201).json(application);
  } catch (error) {
    console.error('Error applying for mentorship:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Accept/Reject mentorship application (for mentors)
const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, message } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const application = await Mentorship.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.mentor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this application' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Application has already been processed' });
    }

    application.status = status === 'accepted' ? 'active' : 'rejected';
    
    if (message) {
      application.communication.notes.push({
        author: req.user.id,
        content: message,
        isPrivate: false
      });
    }

    await application.save();
    await application.populate([
      { path: 'mentor', select: 'profile.name profile.email' },
      { path: 'mentee', select: 'profile.name profile.email' }
    ]);

    res.json(application);
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's mentorships (both as mentor and mentee)
const getUserMentorships = async (req, res) => {
  try {
    const { role = 'all', status = 'all' } = req.query;

    const filter = {};
    if (status !== 'all') {
      filter.status = status;
    }

    let mentorships = [];

    if (role === 'mentor' || role === 'all') {
      const asMentor = await Mentorship.find({ mentor: req.user.id, ...filter })
        .populate('mentee', 'profile.name profile.avatar profile.email')
        .sort({ createdAt: -1 });
      
      mentorships = mentorships.concat(asMentor.map(m => ({ ...m.toObject(), userRole: 'mentor' })));
    }

    if (role === 'mentee' || role === 'all') {
      const asMentee = await Mentorship.find({ mentee: req.user.id, ...filter })
        .populate('mentor', 'profile.name profile.avatar profile.email profile.specialties')
        .sort({ createdAt: -1 });
      
      mentorships = mentorships.concat(asMentee.map(m => ({ ...m.toObject(), userRole: 'mentee' })));
    }

    // Sort by creation date
    mentorships.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(mentorships);
  } catch (error) {
    console.error('Error fetching user mentorships:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add session to mentorship
const addSession = async (req, res) => {
  try {
    const { mentorshipId } = req.params;
    const { scheduledDate, duration, agenda } = req.body;

    const mentorship = await Mentorship.findById(mentorshipId);
    if (!mentorship) {
      return res.status(404).json({ message: 'Mentorship not found' });
    }

    // Check if user is mentor or mentee
    if (mentorship.mentor.toString() !== req.user.id && mentorship.mentee.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const session = {
      scheduledDate: new Date(scheduledDate),
      duration: duration || 60,
      agenda: agenda || '',
      status: 'scheduled'
    };

    mentorship.sessions.push(session);
    await mentorship.save();

    res.status(201).json(mentorship);
  } catch (error) {
    console.error('Error adding session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Complete session with feedback
const completeSession = async (req, res) => {
  try {
    const { mentorshipId, sessionId } = req.params;
    const { feedback, homework, resources } = req.body;

    const mentorship = await Mentorship.findById(mentorshipId);
    if (!mentorship) {
      return res.status(404).json({ message: 'Mentorship not found' });
    }

    // Check if user is mentor or mentee
    if (mentorship.mentor.toString() !== req.user.id && mentorship.mentee.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await mentorship.completeSession(sessionId, feedback);

    if (homework) {
      const session = mentorship.sessions.id(sessionId);
      session.homework = homework;
    }

    if (resources) {
      const session = mentorship.sessions.id(sessionId);
      session.resources = resources;
    }

    await mentorship.save();

    res.json(mentorship);
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add review for mentorship
const addReview = async (req, res) => {
  try {
    const { mentorshipId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const mentorship = await Mentorship.findById(mentorshipId);
    if (!mentorship) {
      return res.status(404).json({ message: 'Mentorship not found' });
    }

    const reviewData = {
      rating: Number(rating),
      comment: comment || '',
      createdAt: new Date()
    };

    if (mentorship.mentor.toString() === req.user.id) {
      mentorship.reviews.mentorReview = reviewData;
    } else if (mentorship.mentee.toString() === req.user.id) {
      mentorship.reviews.menteeReview = reviewData;
    } else {
      return res.status(403).json({ message: 'Not authorized to review this mentorship' });
    }

    await mentorship.save();

    res.json(mentorship);
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getMentorshipPrograms,
  getMentorshipById,
  createMentorshipProgram,
  applyForMentorship,
  updateApplicationStatus,
  getUserMentorships,
  addSession,
  completeSession,
  addReview
};
