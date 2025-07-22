const Commission = require('../models/Commission');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const razorpay = require('../utils/razorpay');
const { sendEmail } = require('../utils/email');

// Create new commission request
const createCommission = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      artistId,
      title,
      description,
      requirements,
      budget
    } = req.body;

    // Verify artist exists and is actually an artist
    const artist = await User.findOne({ _id: artistId, role: 'artist' });
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Calculate estimated timeline if provided
    const timeline = requirements.deadline ? {
      estimatedDays: Math.ceil((new Date(requirements.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    } : {};

    const commission = new Commission({
      client: req.user.id,
      artist: artistId,
      title,
      description,
      requirements,
      budget,
      timeline,
      status: 'pending'
    });

    await commission.save();
    await commission.populate('client artist', 'profile email');

    // Send notification email to artist
    await sendEmail({
      to: artist.email,
      subject: 'New Commission Request',
      template: 'commission-request',
      data: {
        artistName: artist.profile.firstName,
        clientName: req.user.profile.firstName,
        commissionTitle: title,
        commissionUrl: `${process.env.CLIENT_URL}/commission/${commission._id}`
      }
    });

    res.status(201).json({
      message: 'Commission request created successfully',
      commission
    });
  } catch (error) {
    console.error('Error creating commission:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get commissions (filtered by user role)
const getCommissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter based on user role
    const filter = {};
    if (req.user.role === 'artist') {
      filter.artist = req.user.id;
    } else {
      filter.client = req.user.id;
    }

    if (status) {
      filter.status = status;
    }

    const commissions = await Commission.find(filter)
      .populate('client artist', 'profile email')
      .sort({ 'metadata.createdAt': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Commission.countDocuments(filter);

    res.json({
      commissions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get commission by ID
const getCommissionById = async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id)
      .populate('client artist', 'profile email artistProfile');

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Check if user is authorized to view this commission
    if (commission.client._id.toString() !== req.user.id && 
        commission.artist._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this commission' });
    }

    res.json({ commission });
  } catch (error) {
    console.error('Error fetching commission:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update commission status
const updateCommissionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Check authorization
    if (commission.client.toString() !== req.user.id && 
        commission.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await commission.updateStatus(status, req.user.id);
    await commission.populate('client artist', 'profile email');

    // Send notification based on status change
    const recipient = commission.client._id.toString() === req.user.id ? 
      commission.artist : commission.client;

    await sendEmail({
      to: recipient.email,
      subject: `Commission Status Updated: ${commission.title}`,
      template: 'commission-status-update',
      data: {
        recipientName: recipient.profile.firstName,
        commissionTitle: commission.title,
        newStatus: status,
        commissionUrl: `${process.env.CLIENT_URL}/commission/${commission._id}`
      }
    });

    res.json({
      message: 'Commission status updated successfully',
      commission
    });
  } catch (error) {
    console.error('Error updating commission status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add message to commission
const addMessage = async (req, res) => {
  try {
    const { message, attachments = [], type = 'message' } = req.body;
    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Check authorization
    if (commission.client.toString() !== req.user.id && 
        commission.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await commission.addMessage(req.user.id, message, attachments, type);
    await commission.populate('client artist', 'profile email');

    // Send notification to the other party
    const recipient = commission.client._id.toString() === req.user.id ? 
      commission.artist : commission.client;

    await sendEmail({
      to: recipient.email,
      subject: `New Message: ${commission.title}`,
      template: 'commission-message',
      data: {
        recipientName: recipient.profile.firstName,
        senderName: req.user.profile.firstName,
        commissionTitle: commission.title,
        message: message,
        commissionUrl: `${process.env.CLIENT_URL}/commission/${commission._id}`
      }
    });

    res.json({
      message: 'Message added successfully',
      commission
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Submit quote (artist only)
const submitQuote = async (req, res) => {
  try {
    const { proposedPrice, timeline, milestones, terms } = req.body;
    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Check if user is the artist
    if (commission.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the artist can submit quotes' });
    }

    // Update commission with quote details
    commission.proposedPrice = proposedPrice;
    commission.timeline = { ...commission.timeline, ...timeline };
    commission.milestones = milestones || [];
    commission.contract.terms = terms;
    commission.status = 'quoted';

    await commission.save();
    await commission.populate('client artist', 'profile email');

    // Send notification to client
    await sendEmail({
      to: commission.client.email,
      subject: `Quote Received: ${commission.title}`,
      template: 'commission-quote',
      data: {
        clientName: commission.client.profile.firstName,
        artistName: commission.artist.profile.firstName,
        commissionTitle: commission.title,
        proposedPrice: proposedPrice,
        commissionUrl: `${process.env.CLIENT_URL}/commission/${commission._id}`
      }
    });

    res.json({
      message: 'Quote submitted successfully',
      commission
    });
  } catch (error) {
    console.error('Error submitting quote:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Accept quote (client only)
const acceptQuote = async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Check if user is the client
    if (commission.client.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the client can accept quotes' });
    }

    // Update commission
    commission.agreedPrice = commission.proposedPrice;
    commission.status = 'accepted';
    commission.timeline.startDate = new Date();
    
    if (commission.timeline.estimatedDays) {
      commission.timeline.expectedCompletion = new Date(
        Date.now() + commission.timeline.estimatedDays * 24 * 60 * 60 * 1000
      );
    }

    // Create payment schedule based on milestones
    if (commission.milestones.length > 0) {
      commission.payment.totalAmount = commission.agreedPrice;
      commission.payment.paymentSchedule = commission.milestones.map(milestone => ({
        amount: (commission.agreedPrice * milestone.paymentPercentage) / 100,
        dueDate: milestone.dueDate
      }));
    } else {
      // Default: 50% upfront, 50% on completion
      commission.payment.totalAmount = commission.agreedPrice;
      commission.payment.paymentSchedule = [
        {
          amount: commission.agreedPrice * 0.5,
          dueDate: new Date()
        },
        {
          amount: commission.agreedPrice * 0.5,
          dueDate: commission.timeline.expectedCompletion || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      ];
    }

    await commission.save();
    await commission.populate('client artist', 'profile email');

    // Send notification to artist
    await sendEmail({
      to: commission.artist.email,
      subject: `Quote Accepted: ${commission.title}`,
      template: 'commission-accepted',
      data: {
        artistName: commission.artist.profile.firstName,
        clientName: commission.client.profile.firstName,
        commissionTitle: commission.title,
        agreedPrice: commission.agreedPrice,
        commissionUrl: `${process.env.CLIENT_URL}/commission/${commission._id}`
      }
    });

    res.json({
      message: 'Quote accepted successfully',
      commission
    });
  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload work in progress (artist only)
const uploadProgress = async (req, res) => {
  try {
    const { title, description, images } = req.body;
    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Check if user is the artist
    if (commission.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the artist can upload progress' });
    }

    commission.workInProgress.push({
      title,
      description,
      images,
      uploadDate: new Date()
    });

    await commission.save();
    await commission.populate('client artist', 'profile email');

    // Send notification to client
    await sendEmail({
      to: commission.client.email,
      subject: `Progress Update: ${commission.title}`,
      template: 'commission-progress',
      data: {
        clientName: commission.client.profile.firstName,
        artistName: commission.artist.profile.firstName,
        commissionTitle: commission.title,
        progressTitle: title,
        commissionUrl: `${process.env.CLIENT_URL}/commission/${commission._id}`
      }
    });

    res.json({
      message: 'Progress uploaded successfully',
      commission
    });
  } catch (error) {
    console.error('Error uploading progress:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Complete milestone
const completeMilestone = async (req, res) => {
  try {
    const { milestoneIndex } = req.params;
    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    // Check if user is the artist
    if (commission.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the artist can complete milestones' });
    }

    const milestone = commission.milestones[milestoneIndex];
    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    milestone.completed = true;
    milestone.completedDate = new Date();

    await commission.save();
    await commission.populate('client artist', 'profile email');

    res.json({
      message: 'Milestone completed successfully',
      commission
    });
  } catch (error) {
    console.error('Error completing milestone:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get commission statistics
const getCommissionStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const filter = userRole === 'artist' ? { artist: userId } : { client: userId };

    const stats = await Commission.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$agreedPrice' }
        }
      }
    ]);

    const totalCommissions = await Commission.countDocuments(filter);
    const totalValue = await Commission.aggregate([
      { $match: { ...filter, agreedPrice: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$agreedPrice' } } }
    ]);

    res.json({
      totalCommissions,
      totalValue: totalValue[0]?.total || 0,
      statusBreakdown: stats,
      averageValue: totalValue[0]?.total ? Math.round(totalValue[0].total / totalCommissions) : 0
    });
  } catch (error) {
    console.error('Error fetching commission stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
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
};
