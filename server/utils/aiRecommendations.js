const User = require('../models/User');
const Artwork = require('../models/Artwork');
const Order = require('../models/Order');

class SimpleRecommendationEngine {
  constructor() {
    this.isInitialized = true;
  }

  async initialize() {
    // No-op for simple engine
    return true;
  }

  // Get personalized recommendations based on user behavior
  async getPersonalizedRecommendations(userId, options = {}) {
    try {
      const {
        limit = 10,
        category,
        priceRange,
        excludeOwned = true
      } = options;

      // Get user's interaction history
      const user = await User.findById(userId).populate('wishlist');
      const orders = await Order.find({ user: userId }).populate('items.artwork');

      // Get categories and price ranges from user's history
      const userCategories = new Set();
      const userPriceRanges = [];
      
      // Analyze wishlist
      if (user.wishlist) {
        user.wishlist.forEach(artwork => {
          if (artwork.category) userCategories.add(artwork.category);
          if (artwork.price) userPriceRanges.push(artwork.price);
        });
      }

      // Analyze purchase history
      orders.forEach(order => {
        order.items.forEach(item => {
          if (item.artwork && item.artwork.category) {
            userCategories.add(item.artwork.category);
          }
          if (item.artwork && item.artwork.price) {
            userPriceRanges.push(item.artwork.price);
          }
        });
      });

      // Calculate average price range
      const avgPrice = userPriceRanges.length > 0 
        ? userPriceRanges.reduce((a, b) => a + b, 0) / userPriceRanges.length 
        : 500;

      // Build query
      const query = {
        status: 'available'
      };

      // Add category filter
      if (category && category !== 'all') {
        query.category = category;
      } else if (userCategories.size > 0) {
        query.category = { $in: Array.from(userCategories) };
      }

      // Add price range filter
      if (priceRange) {
        const [min, max] = priceRange.split('-').map(Number);
        query.price = { $gte: min, $lte: max };
      } else {
        // Use user's average price range ±50%
        query.price = { 
          $gte: avgPrice * 0.5, 
          $lte: avgPrice * 1.5 
        };
      }

      // Exclude owned artworks
      if (excludeOwned) {
        const ownedArtworkIds = [];
        
        // Add wishlist items
        if (user.wishlist) {
          ownedArtworkIds.push(...user.wishlist.map(artwork => artwork._id));
        }
        
        // Add purchased items
        orders.forEach(order => {
          order.items.forEach(item => {
            if (item.artwork) ownedArtworkIds.push(item.artwork._id);
          });
        });

        if (ownedArtworkIds.length > 0) {
          query._id = { $nin: ownedArtworkIds };
        }
      }

      // Get recommendations with popularity score
      const recommendations = await Artwork.find(query)
        .populate('artist', 'profile verification')
        .sort({ 
          views: -1,
          likes: -1,
          createdAt: -1
        })
        .limit(limit * 2); // Get more to allow for filtering

      // Simple scoring algorithm
      const scoredRecommendations = recommendations.map(artwork => {
        let score = 0;
        
        // Category match bonus
        if (userCategories.has(artwork.category)) {
          score += 10;
        }
        
        // Price similarity bonus
        const priceDiff = Math.abs(artwork.price - avgPrice) / avgPrice;
        score += Math.max(0, 5 - priceDiff * 5);
        
        // Popularity bonus
        score += (artwork.views || 0) * 0.01;
        score += (artwork.likes || 0) * 0.1;
        
        // Verified artist bonus
        if (artwork.artist?.verification?.status === 'verified') {
          score += 3;
        }
        
        // Recent artwork bonus
        const daysSinceCreated = (Date.now() - artwork.createdAt) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated < 30) {
          score += 2;
        }

        return { ...artwork.toObject(), score };
      });

      // Sort by score and return top recommendations
      return scoredRecommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      // Fallback to trending artworks
      return this.getTrendingArtworks({ limit: options.limit || 10 });
    }
  }

  // Get trending artworks based on recent activity
  async getTrendingArtworks(options = {}) {
    try {
      const { limit = 10, timeframe = 30 } = options;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframe);

      const trending = await Artwork.find({
        status: 'available',
        createdAt: { $gte: startDate }
      })
      .populate('artist', 'profile verification')
      .sort({
        views: -1,
        likes: -1,
        createdAt: -1
      })
      .limit(limit);

      return trending;
    } catch (error) {
      console.error('Error getting trending artworks:', error);
      return [];
    }
  }

  // Get similar artworks based on category and style
  async getSimilarArtworks(artworkId, options = {}) {
    try {
      const { limit = 10 } = options;
      
      const sourceArtwork = await Artwork.findById(artworkId);
      if (!sourceArtwork) {
        return [];
      }

      const similar = await Artwork.find({
        _id: { $ne: artworkId },
        status: 'available',
        $or: [
          { category: sourceArtwork.category },
          { style: sourceArtwork.style },
          { 
            price: { 
              $gte: sourceArtwork.price * 0.7, 
              $lte: sourceArtwork.price * 1.3 
            } 
          }
        ]
      })
      .populate('artist', 'profile verification')
      .sort({ views: -1, likes: -1 })
      .limit(limit);

      return similar;
    } catch (error) {
      console.error('Error getting similar artworks:', error);
      return [];
    }
  }

  // Get recommendations for new users (no history)
  async getNewUserRecommendations(options = {}) {
    try {
      const { limit = 10 } = options;
      
      // Get most popular artworks overall
      const popular = await Artwork.find({ status: 'available' })
        .populate('artist', 'profile verification')
        .sort({
          likes: -1,
          views: -1,
          createdAt: -1
        })
        .limit(limit);

      return popular;
    } catch (error) {
      console.error('Error getting new user recommendations:', error);
      return [];
    }
  }

  // Update user interaction for future recommendations
  async updateUserInteraction(userId, artworkId, interactionType) {
    try {
      // In a more sophisticated system, we would store interaction data
      // For now, we'll just log it
      console.log(`User ${userId} ${interactionType} artwork ${artworkId}`);
      
      // Update artwork views/likes if applicable
      if (interactionType === 'view') {
        await Artwork.findByIdAndUpdate(artworkId, {
          $inc: { views: 1 }
        });
      } else if (interactionType === 'like') {
        await Artwork.findByIdAndUpdate(artworkId, {
          $inc: { likes: 1 }
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating user interaction:', error);
      return false;
    }
  }

  // Get category-based recommendations
  async getCategoryRecommendations(category, options = {}) {
    try {
      const { limit = 10, excludeIds = [] } = options;
      
      const query = {
        category,
        status: 'available'
      };

      if (excludeIds.length > 0) {
        query._id = { $nin: excludeIds };
      }

      const recommendations = await Artwork.find(query)
        .populate('artist', 'profile verification')
        .sort({
          likes: -1,
          views: -1,
          createdAt: -1
        })
        .limit(limit);

      return recommendations;
    } catch (error) {
      console.error('Error getting category recommendations:', error);
      return [];
    }
  }

  // Get artist-based recommendations
  async getArtistRecommendations(artistId, options = {}) {
    try {
      const { limit = 10, excludeIds = [] } = options;
      
      const query = {
        artist: artistId,
        status: 'available'
      };

      if (excludeIds.length > 0) {
        query._id = { $nin: excludeIds };
      }

      const recommendations = await Artwork.find(query)
        .populate('artist', 'profile verification')
        .sort({
          createdAt: -1,
          likes: -1,
          views: -1
        })
        .limit(limit);

      return recommendations;
    } catch (error) {
      console.error('Error getting artist recommendations:', error);
      return [];
    }
  }

  // Generate recommendation explanation
  getRecommendationReason(artwork, user) {
    const reasons = [];
    
    if (user?.wishlist?.some(w => w.category === artwork.category)) {
      reasons.push(`You've shown interest in ${artwork.category} artworks`);
    }
    
    if (artwork.artist?.verification?.status === 'verified') {
      reasons.push('From a verified artist');
    }
    
    if (artwork.likes > 100) {
      reasons.push('Popular among other users');
    }
    
    const daysSinceCreated = (Date.now() - artwork.createdAt) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 7) {
      reasons.push('Recently added');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Recommended for you';
  }
}

// Singleton instance
const recommendationEngine = new SimpleRecommendationEngine();

module.exports = recommendationEngine;
