const express = require('express');
const { auth } = require('../middleware/auth');
const { getPersonalizedRecommendations, getSimilarArtworks } = require('../utils/aiRecommendations');
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const router = express.Router();

// Get personalized recommendations for user
router.get('/personalized', auth, async (req, res) => {
  try {
    const {
      limit = 10,
      category,
      priceRange,
      excludeOwned = true
    } = req.query;

    const recommendations = await getPersonalizedRecommendations(
      req.user.id,
      {
        limit: parseInt(limit),
        category,
        priceRange,
        excludeOwned: excludeOwned === 'true'
      }
    );

    res.json({ recommendations });
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get similar artworks
router.get('/similar/:artworkId', async (req, res) => {
  try {
    const {
      limit = 8,
      excludeSold = true,
      sameMedium = false,
      sameArtist = false
    } = req.query;

    const similar = await getSimilarArtworks(
      req.params.artworkId,
      {
        limit: parseInt(limit),
        excludeSold: excludeSold === 'true',
        sameMedium: sameMedium === 'true',
        sameArtist: sameArtist === 'true'
      }
    );

    res.json({ similar });
  } catch (error) {
    console.error('Error getting similar artworks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending artworks
router.get('/trending', async (req, res) => {
  try {
    const {
      limit = 12,
      timeframe = 'week',
      category
    } = req.query;

    let dateFilter = new Date();
    switch (timeframe) {
      case 'day':
        dateFilter.setDate(dateFilter.getDate() - 1);
        break;
      case 'week':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case 'month':
        dateFilter.setMonth(dateFilter.getMonth() - 1);
        break;
      default:
        dateFilter.setDate(dateFilter.getDate() - 7);
    }

    const filter = {
      status: 'available',
      createdAt: { $gte: dateFilter }
    };

    if (category && category !== 'all') {
      filter.category = category;
    }

    // Get trending artworks based on views, likes, and recent activity
    const artworks = await Artwork.find(filter)
      .populate('artist', 'profile')
      .sort({ 
        views: -1, 
        likes: -1, 
        createdAt: -1 
      })
      .limit(parseInt(limit));

    res.json({ artworks });
  } catch (error) {
    console.error('Error getting trending artworks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recommended artists
router.get('/artists', auth, async (req, res) => {
  try {
    const {
      limit = 6,
      excludeFollowed = true
    } = req.query;

    const user = await User.findById(req.user.id).populate('following');
    const followedArtistIds = user.following.map(f => f._id);

    const filter = {
      role: 'artist',
      'verification.status': 'verified'
    };

    if (excludeFollowed === 'true' && followedArtistIds.length > 0) {
      filter._id = { $nin: followedArtistIds };
    }

    // Get artists with highest ratings and most artworks
    const artists = await User.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'artworks',
          localField: '_id',
          foreignField: 'artist',
          as: 'artworks'
        }
      },
      {
        $addFields: {
          artworksCount: { $size: '$artworks' },
          categories: {
            $setUnion: ['$artworks.category']
          }
        }
      },
      {
        $match: {
          artworksCount: { $gt: 0 }
        }
      },
      {
        $sort: {
          'rating.average': -1,
          artworksCount: -1,
          'verification.verifiedAt': -1
        }
      },
      { $limit: parseInt(limit) },
      {
        $project: {
          profile: 1,
          rating: 1,
          artworksCount: 1,
          categories: 1,
          verification: 1
        }
      }
    ]);

    res.json({ artists });
  } catch (error) {
    console.error('Error getting recommended artists:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get curated collections
router.get('/collections', async (req, res) => {
  try {
    const {
      limit = 4,
      theme
    } = req.query;

    // Mock curated collections - in production, this would be managed by admins
    const collections = [
      {
        _id: 'trending-digital',
        title: 'Trending Digital Art',
        description: 'The most popular digital artworks this month',
        coverImage: '/collection-covers/digital-art.jpg',
        artworksCount: 24,
        theme: 'digital'
      },
      {
        _id: 'emerging-artists',
        title: 'Emerging Artists',
        description: 'Discover new talent in the art world',
        coverImage: '/collection-covers/emerging.jpg',
        artworksCount: 18,
        theme: 'artists'
      },
      {
        _id: 'abstract-masters',
        title: 'Abstract Masters',
        description: 'Contemporary abstract art from verified artists',
        coverImage: '/collection-covers/abstract.jpg',
        artworksCount: 32,
        theme: 'abstract'
      },
      {
        _id: 'photography-gems',
        title: 'Photography Gems',
        description: 'Stunning photography from around the world',
        coverImage: '/collection-covers/photography.jpg',
        artworksCount: 15,
        theme: 'photography'
      }
    ];

    let filteredCollections = collections;
    if (theme && theme !== 'all') {
      filteredCollections = collections.filter(c => c.theme === theme);
    }

    res.json({ 
      collections: filteredCollections.slice(0, parseInt(limit))
    });
  } catch (error) {
    console.error('Error getting curated collections:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Record user interaction for recommendation improvement
router.post('/interaction', auth, async (req, res) => {
  try {
    const {
      artworkId,
      artistId,
      action,
      duration,
      metadata = {}
    } = req.body;

    // In a production system, this would be stored in an analytics database
    // For now, we'll just log it and return success
    console.log('User interaction recorded:', {
      userId: req.user.id,
      artworkId,
      artistId,
      action,
      duration,
      metadata,
      timestamp: new Date()
    });

    // Update artwork views if it's a view action
    if (action === 'view' && artworkId) {
      await Artwork.findByIdAndUpdate(artworkId, {
        $inc: { views: 1 }
      });
    }

    // Update artwork likes if it's a like action
    if (action === 'like' && artworkId) {
      await Artwork.findByIdAndUpdate(artworkId, {
        $inc: { likes: 1 }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording interaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get search-based recommendations
router.get('/search', async (req, res) => {
  try {
    const {
      query,
      limit = 10
    } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Find similar artworks based on search query
    const artworks = await Artwork.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { medium: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ],
      status: 'available'
    })
    .populate('artist', 'profile')
    .sort({ views: -1, likes: -1 })
    .limit(parseInt(limit));

    res.json({ recommendations: artworks });
  } catch (error) {
    console.error('Error getting search recommendations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get price recommendations for artists
router.post('/pricing', auth, async (req, res) => {
  try {
    const {
      category,
      medium,
      dimensions,
      artistExperience,
      complexity,
      materials
    } = req.body;

    // Simple pricing algorithm - in production, this would use ML models
    let basePrice = 100;

    // Category multiplier
    const categoryMultipliers = {
      'painting': 1.5,
      'sculpture': 2.0,
      'photography': 1.0,
      'digital': 0.8,
      'drawing': 1.2,
      'mixed': 1.3
    };

    basePrice *= categoryMultipliers[category] || 1.0;

    // Size multiplier
    if (dimensions) {
      const area = (dimensions.width || 12) * (dimensions.height || 12);
      const sizeMultiplier = Math.sqrt(area / 144); // Base: 12x12 inches
      basePrice *= sizeMultiplier;
    }

    // Experience multiplier
    const experienceMultipliers = {
      'beginner': 0.7,
      'intermediate': 1.0,
      'advanced': 1.5,
      'professional': 2.5
    };

    basePrice *= experienceMultipliers[artistExperience] || 1.0;

    // Complexity multiplier
    if (complexity) {
      const complexityMultipliers = {
        'simple': 0.8,
        'moderate': 1.0,
        'complex': 1.4,
        'highly_complex': 2.0
      };
      basePrice *= complexityMultipliers[complexity] || 1.0;
    }

    // Generate price range
    const minPrice = Math.round(basePrice * 0.8);
    const maxPrice = Math.round(basePrice * 1.3);
    const suggestedPrice = Math.round(basePrice);

    res.json({
      suggestedPrice,
      priceRange: {
        min: minPrice,
        max: maxPrice
      },
      factors: {
        category: categoryMultipliers[category] || 1.0,
        experience: experienceMultipliers[artistExperience] || 1.0,
        size: dimensions ? Math.sqrt(((dimensions.width || 12) * (dimensions.height || 12)) / 144) : 1.0,
        complexity: complexity ? (complexityMultipliers[complexity] || 1.0) : 1.0
      }
    });
  } catch (error) {
    console.error('Error getting price recommendations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
