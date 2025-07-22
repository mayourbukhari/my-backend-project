const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const router = express.Router();

// Get verification status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('verification');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.verification || { status: 'not_submitted' });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit verification application
router.post('/submit', auth, upload.array('documents', 10), async (req, res) => {
  try {
    const {
      artistName,
      realName,
      bio,
      experience,
      education,
      exhibitions,
      awards,
      socialProfiles
    } = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'artist') {
      return res.status(400).json({ message: 'Only artists can apply for verification' });
    }

    // Process uploaded documents
    const documents = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    })) : [];

    // Update user verification data
    user.verification = {
      status: 'pending',
      submittedAt: new Date(),
      formData: {
        artistName,
        realName,
        bio,
        experience,
        education,
        exhibitions,
        awards,
        socialProfiles: typeof socialProfiles === 'string' ? JSON.parse(socialProfiles) : socialProfiles,
        documents
      }
    };

    await user.save();

    res.json({
      status: 'pending',
      message: 'Verification application submitted successfully',
      submittedAt: user.verification.submittedAt
    });
  } catch (error) {
    console.error('Error submitting verification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get pending verifications
router.get('/pending', auth, async (req, res) => {
  try {
    // Check if user is admin
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pendingVerifications = await User.find({
      'verification.status': 'pending'
    }).select('profile verification createdAt');

    res.json(pendingVerifications);
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Review verification
router.put('/review/:userId', auth, async (req, res) => {
  try {
    const { status, feedback } = req.body;
    
    // Check if user is admin
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.verification || user.verification.status !== 'pending') {
      return res.status(400).json({ message: 'No pending verification found' });
    }

    // Update verification status
    user.verification.status = status;
    user.verification.reviewedAt = new Date();
    user.verification.reviewedBy = req.user.id;
    
    if (status === 'rejected' && feedback) {
      user.verification.feedback = feedback;
    }

    if (status === 'verified') {
      user.verification.verifiedAt = new Date();
      // Copy form data to profile if verified
      if (user.verification.formData) {
        user.profile = {
          ...user.profile,
          artistName: user.verification.formData.artistName,
          bio: user.verification.formData.bio,
          experience: user.verification.formData.experience,
          education: user.verification.formData.education,
          exhibitions: user.verification.formData.exhibitions,
          awards: user.verification.formData.awards,
          socialProfiles: user.verification.formData.socialProfiles
        };
      }
    }

    await user.save();

    res.json({
      message: `Verification ${status} successfully`,
      verification: user.verification
    });
  } catch (error) {
    console.error('Error reviewing verification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get verification statistics
router.get('/stats', auth, async (req, res) => {
  try {
    // Check if user is admin
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const stats = await User.aggregate([
      {
        $match: {
          role: 'artist'
        }
      },
      {
        $group: {
          _id: '$verification.status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      total: 0,
      verified: 0,
      pending: 0,
      rejected: 0,
      not_submitted: 0
    };

    stats.forEach(stat => {
      const status = stat._id || 'not_submitted';
      formattedStats[status] = stat.count;
      formattedStats.total += stat.count;
    });

    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get verification details
router.get('/details/:userId', auth, async (req, res) => {
  try {
    // Check if user is admin or requesting own data
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.params.userId)
      .select('profile verification createdAt')
      .populate('verification.reviewedBy', 'profile.firstName profile.lastName');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching verification details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
