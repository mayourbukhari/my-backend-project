const mongoose = require('mongoose');

const nftSchema = new mongoose.Schema({
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tokenId: {
    type: String,
    required: true,
    unique: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  blockchain: {
    type: String,
    enum: ['ethereum', 'polygon', 'bsc', 'arbitrum'],
    default: 'polygon'
  },
  metadata: {
    name: String,
    description: String,
    image: String,
    external_url: String,
    attributes: [{
      trait_type: String,
      value: mongoose.Schema.Types.Mixed,
      display_type: String,
      max_value: Number
    }],
    animation_url: String,
    youtube_url: String
  },
  mintingInfo: {
    transactionHash: String,
    blockNumber: Number,
    mintedAt: {
      type: Date,
      default: Date.now
    },
    gasUsed: Number,
    gasPrice: String
  },
  pricing: {
    listingPrice: {
      amount: Number,
      currency: {
        type: String,
        enum: ['ETH', 'MATIC', 'BNB', 'USDC', 'USDT'],
        default: 'MATIC'
      }
    },
    auctionDetails: {
      isAuction: {
        type: Boolean,
        default: false
      },
      startingBid: Number,
      currentBid: Number,
      highestBidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      endTime: Date,
      reservePrice: Number
    },
    royalty: {
      percentage: {
        type: Number,
        min: 0,
        max: 10,
        default: 2.5
      },
      recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  },
  status: {
    type: String,
    enum: ['minting', 'minted', 'listed', 'sold', 'transferred', 'burned'],
    default: 'minting'
  },
  saleHistory: [{
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    price: {
      amount: Number,
      currency: String
    },
    transactionHash: String,
    saleDate: {
      type: Date,
      default: Date.now
    },
    platform: {
      type: String,
      enum: ['artist-marketplace', 'opensea', 'rarible', 'foundation', 'superrare'],
      default: 'artist-marketplace'
    }
  }],
  bidHistory: [{
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    currency: String,
    bidDate: {
      type: Date,
      default: Date.now
    },
    transactionHash: String,
    status: {
      type: String,
      enum: ['active', 'outbid', 'withdrawn', 'accepted'],
      default: 'active'
    }
  }],
  provenance: [{
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acquiredDate: Date,
    acquisitionMethod: {
      type: String,
      enum: ['minted', 'purchased', 'transferred', 'gifted']
    },
    transactionHash: String,
    notes: String
  }],
  verification: {
    isAuthentic: {
      type: Boolean,
      default: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationDate: Date,
    certificateUrl: String
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    priceHistory: [{
      price: Number,
      currency: String,
      date: Date,
      event: {
        type: String,
        enum: ['listed', 'bid', 'sale', 'transfer']
      }
    }]
  },
  ipfsData: {
    metadataHash: String,
    imageHash: String,
    gateway: {
      type: String,
      default: 'https://ipfs.io/ipfs/'
    },
    pinned: {
      type: Boolean,
      default: false
    }
  },
  socialMedia: {
    twitterShared: {
      type: Boolean,
      default: false
    },
    instagramShared: {
      type: Boolean,
      default: false
    },
    discordShared: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
nftSchema.index({ tokenId: 1, contractAddress: 1 }, { unique: true });
nftSchema.index({ creator: 1, status: 1 });
nftSchema.index({ currentOwner: 1, status: 1 });
nftSchema.index({ 'pricing.listingPrice.amount': 1 });
nftSchema.index({ 'pricing.auctionDetails.endTime': 1 });
nftSchema.index({ createdAt: -1 });

// Virtual for NFT URL
nftSchema.virtual('url').get(function() {
  return `/nft/${this.tokenId}`;
});

// Virtual for OpenSea URL
nftSchema.virtual('openSeaUrl').get(function() {
  return `https://opensea.io/assets/${this.contractAddress}/${this.tokenId}`;
});

// Pre-save middleware
nftSchema.pre('save', function(next) {
  if (this.isNew) {
    this.provenance.push({
      owner: this.currentOwner,
      acquiredDate: new Date(),
      acquisitionMethod: 'minted'
    });
  }
  next();
});

// Methods
nftSchema.methods.updatePrice = function(newPrice, currency) {
  this.pricing.listingPrice = {
    amount: newPrice,
    currency: currency
  };
  
  this.analytics.priceHistory.push({
    price: newPrice,
    currency: currency,
    date: new Date(),
    event: 'listed'
  });
  
  return this.save();
};

nftSchema.methods.placeBid = function(bidderId, amount, currency, transactionHash) {
  // Update current bid if higher
  if (!this.pricing.auctionDetails.currentBid || amount > this.pricing.auctionDetails.currentBid) {
    this.pricing.auctionDetails.currentBid = amount;
    this.pricing.auctionDetails.highestBidder = bidderId;
  }
  
  // Add to bid history
  this.bidHistory.push({
    bidder: bidderId,
    amount: amount,
    currency: currency,
    transactionHash: transactionHash,
    bidDate: new Date()
  });
  
  // Add to analytics
  this.analytics.priceHistory.push({
    price: amount,
    currency: currency,
    date: new Date(),
    event: 'bid'
  });
  
  return this.save();
};

nftSchema.methods.transferOwnership = function(newOwnerId, transactionHash, acquisitionMethod = 'transferred') {
  const oldOwner = this.currentOwner;
  this.currentOwner = newOwnerId;
  
  // Add to provenance
  this.provenance.push({
    owner: newOwnerId,
    acquiredDate: new Date(),
    acquisitionMethod: acquisitionMethod,
    transactionHash: transactionHash
  });
  
  return this.save();
};

nftSchema.methods.recordSale = function(sellerId, buyerId, price, currency, transactionHash, platform = 'artist-marketplace') {
  // Add to sale history
  this.saleHistory.push({
    seller: sellerId,
    buyer: buyerId,
    price: {
      amount: price,
      currency: currency
    },
    transactionHash: transactionHash,
    platform: platform
  });
  
  // Update owner
  this.currentOwner = buyerId;
  this.status = 'sold';
  
  // Add to provenance
  this.provenance.push({
    owner: buyerId,
    acquiredDate: new Date(),
    acquisitionMethod: 'purchased',
    transactionHash: transactionHash
  });
  
  // Add to analytics
  this.analytics.priceHistory.push({
    price: price,
    currency: currency,
    date: new Date(),
    event: 'sale'
  });
  
  return this.save();
};

// Static methods
nftSchema.statics.getTopSelling = function(limit = 10) {
  return this.aggregate([
    {
      $match: { status: { $in: ['listed', 'sold'] } }
    },
    {
      $unwind: '$saleHistory'
    },
    {
      $group: {
        _id: '$_id',
        totalSales: { $sum: '$saleHistory.price.amount' },
        salesCount: { $sum: 1 },
        nft: { $first: '$$ROOT' }
      }
    },
    {
      $sort: { totalSales: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

nftSchema.statics.getTrending = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    'analytics.priceHistory.date': { $gte: startDate }
  })
  .sort({ 'analytics.views': -1, 'analytics.likes': -1 })
  .populate('creator currentOwner', 'profile username')
  .limit(20);
};

nftSchema.statics.getByPriceRange = function(minPrice, maxPrice, currency = 'MATIC') {
  return this.find({
    'pricing.listingPrice.currency': currency,
    'pricing.listingPrice.amount': {
      $gte: minPrice,
      $lte: maxPrice
    },
    status: 'listed'
  }).populate('creator currentOwner', 'profile username');
};

module.exports = mongoose.model('NFT', nftSchema);
