const User = require('../models/User');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../utils/email');
const cloudinary = require('../utils/cloudinary');

// Submit verification documents
const submitVerification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'artist') {
      return res.status(403).json({ message: 'Only artists can submit verification' });
    }

    const { documents, additionalInfo } = req.body;

    // Update user verification status
    user.verification = {
      status: 'under_review',
      submittedAt: new Date(),
      documents: documents,
      notes: additionalInfo || ''
    };

    await user.save();

    // Send notification email to admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: 'New Artist Verification Request',
        template: 'verification-submitted',
        data: {
          adminName: admin.profile.firstName,
          artistName: `${user.profile.firstName} ${user.profile.lastName}`,
          artistEmail: user.email,
          submittedAt: new Date().toLocaleDateString(),
          verificationUrl: `${process.env.ADMIN_URL}/verification/${user._id}`
        }
      });
    }

    // Send confirmation email to artist
    await sendEmail({
      to: user.email,
      subject: 'Verification Documents Submitted',
      template: 'verification-confirmation',
      data: {
        artistName: user.profile.firstName,
        submittedAt: new Date().toLocaleDateString()
      }
    });

    res.json({
      message: 'Verification documents submitted successfully',
      verification: user.verification
    });
  } catch (error) {
    console.error('Error submitting verification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get verification status
const getVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('verification');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      verification: user.verification || { status: 'pending' }
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Get pending verifications
const getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'under_review' } = req.query;
    const skip = (page - 1) * limit;

    const users = await User.find({
      role: 'artist',
      'verification.status': status
    })
    .select('profile email verification artistProfile createdAt')
    .sort({ 'verification.submittedAt': -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await User.countDocuments({
      role: 'artist',
      'verification.status': status
    });

    res.json({
      verifications: users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Review verification
const reviewVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { decision, notes, badgeType = 'verified' } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid decision' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update verification status
    user.verification.status = decision;
    user.verification.reviewedAt = new Date();
    user.verification.reviewedBy = req.user.id;
    user.verification.notes = notes || '';

    if (decision === 'approved') {
      user.verification.badge = {
        type: badgeType,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      };
    }

    await user.save();

    // Send notification email to artist
    await sendEmail({
      to: user.email,
      subject: `Verification ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
      template: decision === 'approved' ? 'verification-approved' : 'verification-rejected',
      data: {
        artistName: user.profile.firstName,
        badgeType: badgeType,
        notes: notes,
        reviewDate: new Date().toLocaleDateString()
      }
    });

    res.json({
      message: `Verification ${decision} successfully`,
      verification: user.verification
    });
  } catch (error) {
    console.error('Error reviewing verification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload verification document
const uploadVerificationDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { documentType } = req.body;
    
    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'verification-documents',
      resource_type: 'auto'
    });

    res.json({
      message: 'Document uploaded successfully',
      document: {
        type: documentType,
        url: result.secure_url,
        filename: req.file.originalname,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get verification requirements
const getVerificationRequirements = async (req, res) => {
  try {
    const requirements = {
      required_documents: [
        {
          type: 'id_document',
          label: 'Government ID',
          description: 'Valid government-issued photo identification',
          accepted_formats: ['jpg', 'jpeg', 'png', 'pdf'],
          max_size_mb: 10
        },
        {
          type: 'portfolio',
          label: 'Portfolio Sample',
          description: 'High-quality images of your original artwork (minimum 5 pieces)',
          accepted_formats: ['jpg', 'jpeg', 'png'],
          max_size_mb: 5,
          min_count: 5
        }
      ],
      optional_documents: [
        {
          type: 'education_certificate',
          label: 'Art Education Certificate',
          description: 'Degree or certificate from art school or university'
        },
        {
          type: 'exhibition_record',
          label: 'Exhibition Records',
          description: 'Documentation of previous exhibitions or shows'
        },
        {
          type: 'press_coverage',
          label: 'Press Coverage',
          description: 'Articles, reviews, or media coverage of your work'
        }
      ],
      verification_process: [
        'Submit required documents',
        'Admin review (2-5 business days)',
        'Additional information request (if needed)',
        'Final decision notification',
        'Badge issuance (if approved)'
      ],
      badge_benefits: {
        verified: [
          'Verified artist badge on profile',
          'Higher search ranking',
          'Client trust indicator',
          'Commission eligibility'
        ],
        premium: [
          'All verified benefits',
          'Featured artist opportunities',
          'Priority customer support',
          'Advanced analytics'
        ],
        master: [
          'All premium benefits',
          'Gallery partnership opportunities',
          'Curated collection inclusion',
          'Professional marketing support'
        ]
      }
    };

    res.json(requirements);
  } catch (error) {
    console.error('Error fetching verification requirements:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get artist verification statistics (admin only)
const getVerificationStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $match: { role: 'artist' }
      },
      {
        $group: {
          _id: '$verification.status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalArtists = await User.countDocuments({ role: 'artist' });
    const verifiedArtists = await User.countDocuments({ 
      role: 'artist', 
      'verification.status': 'approved' 
    });

    const badgeStats = await User.aggregate([
      {
        $match: { 
          role: 'artist',
          'verification.status': 'approved'
        }
      },
      {
        $group: {
          _id: '$verification.badge.type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalArtists,
      verifiedArtists,
      verificationRate: totalArtists > 0 ? Math.round((verifiedArtists / totalArtists) * 100) : 0,
      statusBreakdown: stats,
      badgeBreakdown: badgeStats
    });
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  submitVerification,
  getVerificationStatus,
  getPendingVerifications,
  reviewVerification,
  uploadVerificationDocument,
  getVerificationRequirements,
  getVerificationStats
};
