const User = require('../models/User');
const Artwork = require('../models/Artwork');
const Order = require('../models/Order');

// Get all artists
const getArtists = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      verified,
      specialty,
      location,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter for artists
    const filter = { 
      role: 'artist',
      isActive: true,
      'artistProfile.name': { $exists: true, $ne: '' }
    };

    if (verified !== undefined) {
      filter['artistProfile.isVerified'] = verified === 'true';
    }

    if (specialty) {
      filter['artistProfile.specialties'] = { $in: [specialty] };
    }

    if (location) {
      filter['profile.location'] = new RegExp(location, 'i');
    }

    if (search) {
      filter.$or = [
        { 'artistProfile.name': new RegExp(search, 'i') },
        { 'artistProfile.bio': new RegExp(search, 'i') },
        { 'artistProfile.specialties': { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    if (sortBy === 'popularity') {
      sort['followers'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [artists, total] = await Promise.all([
      User.find(filter)
        .select('-password -emailVerificationToken -passwordResetToken')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('followers', '_id')
        .lean(),
      User.countDocuments(filter)
    ]);

    // Get artwork counts and recent works for each artist
    const artistsWithDetails = await Promise.all(
      artists.map(async (artist) => {
        const [artworkCount, recentArtworks] = await Promise.all([
          Artwork.countDocuments({ 
            artist: artist._id, 
            status: 'published', 
            isPublic: true 
          }),
          Artwork.find({ 
            artist: artist._id, 
            status: 'published', 
            isPublic: true 
          })
          .select('title images price')
          .sort({ createdAt: -1 })
          .limit(3)
        ]);

        return {
          ...artist,
          artworkCount,
          recentArtworks,
          followerCount: artist.followers.length
        };
      })
    );

    res.json({
      artists: artistsWithDetails,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({ message: 'Server error while fetching artists' });
  }
};

// Get single artist profile
const getArtistById = async (req, res) => {
  try {
    const { id } = req.params;

    const artist = await User.findOne({ 
      _id: id, 
      role: 'artist',
      isActive: true
    })
    .select('-password -emailVerificationToken -passwordResetToken')
    .populate('followers', 'profile.firstName profile.lastName artistProfile.name')
    .populate('following', 'profile.firstName profile.lastName artistProfile.name');

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Get artist's artworks
    const artworks = await Artwork.find({ 
      artist: id, 
      status: 'published', 
      isPublic: true 
    })
    .sort({ createdAt: -1 })
    .populate('likes.user', '_id');

    // Get artist statistics
    const [totalSales, totalRevenue] = await Promise.all([
      Order.countDocuments({ 
        'items.artist': id,
        status: { $in: ['delivered', 'shipped'] }
      }),
      Order.aggregate([
        { $match: { 'items.artist': artist._id, status: { $in: ['delivered', 'shipped'] } } },
        { $unwind: '$items' },
        { $match: { 'items.artist': artist._id } },
        { $group: { _id: null, total: { $sum: '$items.price' } } }
      ])
    ]);

    const artistProfile = {
      ...artist.toObject(),
      artworks,
      statistics: {
        totalArtworks: artworks.length,
        totalSales,
        totalRevenue: totalRevenue[0]?.total || 0,
        followerCount: artist.followers.length,
        followingCount: artist.following.length
      }
    };

    res.json({ artist: artistProfile });
  } catch (error) {
    console.error('Get artist error:', error);
    res.status(500).json({ message: 'Server error while fetching artist' });
  }
};

// Follow/unfollow artist
const toggleFollowArtist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (id === userId.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const artist = await User.findOne({ _id: id, role: 'artist' });
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const user = await User.findById(userId);
    const isFollowing = user.following.includes(id);

    if (isFollowing) {
      // Unfollow
      user.following.pull(id);
      artist.followers.pull(userId);
    } else {
      // Follow
      user.following.push(id);
      artist.followers.push(userId);
    }

    await Promise.all([user.save(), artist.save()]);

    res.json({
      message: isFollowing ? 'Artist unfollowed' : 'Artist followed',
      following: !isFollowing,
      followerCount: artist.followers.length
    });
  } catch (error) {
    console.error('Toggle follow error:', error);
    res.status(500).json({ message: 'Server error while updating follow status' });
  }
};

// Update artist profile
const updateArtistProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    // Only allow updating artist profile fields
    const allowedUpdates = {
      'artistProfile.name': updates.artistProfile?.name,
      'artistProfile.bio': updates.artistProfile?.bio,
      'artistProfile.statement': updates.artistProfile?.statement,
      'artistProfile.specialties': updates.artistProfile?.specialties,
      'artistProfile.website': updates.artistProfile?.website,
      'artistProfile.socialLinks': updates.artistProfile?.socialLinks,
      'artistProfile.achievements': updates.artistProfile?.achievements,
      'artistProfile.exhibitions': updates.artistProfile?.exhibitions
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(key => {
      if (allowedUpdates[key] === undefined) {
        delete allowedUpdates[key];
      }
    });

    const artist = await User.findByIdAndUpdate(
      userId,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json({
      message: 'Artist profile updated successfully',
      artist
    });
  } catch (error) {
    console.error('Update artist profile error:', error);
    res.status(500).json({ message: 'Server error while updating artist profile' });
  }
};

// Request artist verification
const requestVerification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { documents, portfolio } = req.body;

    const artist = await User.findById(userId);
    if (!artist || artist.role !== 'artist') {
      return res.status(404).json({ message: 'Artist not found' });
    }

    if (artist.artistProfile.verificationStatus === 'pending') {
      return res.status(400).json({ message: 'Verification request already pending' });
    }

    if (artist.artistProfile.isVerified) {
      return res.status(400).json({ message: 'Artist is already verified' });
    }

    // Update verification status
    artist.artistProfile.verificationStatus = 'pending';
    if (portfolio) {
      artist.artistProfile.portfolio = portfolio;
    }

    await artist.save();

    // Here you would typically send a notification to admin
    // or add the request to an admin queue

    res.json({ message: 'Verification request submitted successfully' });
  } catch (error) {
    console.error('Request verification error:', error);
    res.status(500).json({ message: 'Server error while requesting verification' });
  }
};

// Admin: Approve/reject artist verification
const updateVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid verification status' });
    }

    const artist = await User.findOne({ _id: id, role: 'artist' });
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    artist.artistProfile.verificationStatus = status;
    artist.artistProfile.isVerified = status === 'approved';
    
    // You might want to store the reason for rejection
    if (status === 'rejected' && reason) {
      artist.artistProfile.verificationReason = reason;
    }

    await artist.save();

    // Send notification email to artist
    // await sendVerificationStatusEmail(artist.email, artist.artistProfile.name, status, reason);

    res.json({
      message: `Artist verification ${status} successfully`,
      artist
    });
  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({ message: 'Server error while updating verification status' });
  }
};

// Get artist dashboard statistics
const getArtistStats = async (req, res) => {
  try {
    const artistId = req.user._id;

    const [
      totalArtworks,
      totalSales,
      totalRevenue,
      pendingOrders,
      recentOrders,
      topArtworks
    ] = await Promise.all([
      // Total artworks
      Artwork.countDocuments({ artist: artistId }),
      
      // Total sales
      Order.countDocuments({ 
        'items.artist': artistId,
        status: { $in: ['delivered', 'shipped'] }
      }),
      
      // Total revenue
      Order.aggregate([
        { $match: { 'items.artist': artistId, status: { $in: ['delivered', 'shipped'] } } },
        { $unwind: '$items' },
        { $match: { 'items.artist': artistId } },
        { $group: { _id: null, total: { $sum: '$items.price' } } }
      ]),
      
      // Pending orders
      Order.countDocuments({ 
        'items.artist': artistId,
        status: 'pending'
      }),
      
      // Recent orders
      Order.find({ 'items.artist': artistId })
        .populate('customer', 'profile.firstName profile.lastName')
        .populate('items.artwork', 'title images')
        .sort({ createdAt: -1 })
        .limit(5),
      
      // Top performing artworks
      Artwork.find({ artist: artistId })
        .sort({ views: -1, 'likes': -1 })
        .limit(5)
        .select('title images views likes price')
    ]);

    const stats = {
      totalArtworks,
      totalSales,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingOrders,
      recentOrders: recentOrders.map(order => ({
        ...order.toObject(),
        items: order.items.filter(item => item.artist.toString() === artistId.toString())
      })),
      topArtworks
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get artist stats error:', error);
    res.status(500).json({ message: 'Server error while fetching artist statistics' });
  }
};

module.exports = {
  getArtists,
  getArtistById,
  toggleFollowArtist,
  updateArtistProfile,
  requestVerification,
  updateVerificationStatus,
  getArtistStats
};
