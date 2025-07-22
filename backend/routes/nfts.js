const express = require('express');
const NFT = require('../models/NFT');
const Artwork = require('../models/Artwork');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get all NFTs with pagination and filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      priceMin,
      priceMax,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Price range filter
    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = parseFloat(priceMin);
      if (priceMax) filter.price.$lte = parseFloat(priceMax);
    }

    // Only show listed NFTs
    filter.status = 'listed';

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const nfts = await NFT.find(filter)
      .populate('creator', 'profile')
      .populate('currentOwner', 'profile')
      .populate('artwork', 'title images')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await NFT.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      nfts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single NFT by ID
router.get('/:id', async (req, res) => {
  try {
    const nft = await NFT.findById(req.params.id)
      .populate('creator', 'profile')
      .populate('currentOwner', 'profile')
      .populate('artwork', 'title images description category')
      .populate('transactionHistory.buyer', 'profile')
      .populate('transactionHistory.seller', 'profile');

    if (!nft) {
      return res.status(404).json({ message: 'NFT not found' });
    }

    res.json(nft);
  } catch (error) {
    console.error('Error fetching NFT:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mint new NFT (for artists)
router.post('/mint', auth, async (req, res) => {
  try {
    const {
      artworkId,
      name,
      description,
      price,
      royaltyPercentage = 10,
      category,
      attributes = []
    } = req.body;

    // Verify user is the owner of the artwork
    const artwork = await Artwork.findById(artworkId);
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }

    if (artwork.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to mint NFT for this artwork' });
    }

    // Check if NFT already exists for this artwork
    const existingNFT = await NFT.findOne({ artwork: artworkId });
    if (existingNFT) {
      return res.status(400).json({ message: 'NFT already exists for this artwork' });
    }

    // Generate unique token ID (in production, this would be handled by blockchain)
    const tokenId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const nft = new NFT({
      tokenId,
      name,
      description,
      image: artwork.images[0],
      artwork: artworkId,
      creator: req.user.id,
      currentOwner: req.user.id,
      price,
      royaltyPercentage,
      category,
      attributes,
      status: 'listed'
    });

    await nft.save();

    // Populate the response
    await nft.populate('creator', 'profile');
    await nft.populate('currentOwner', 'profile');
    await nft.populate('artwork', 'title images');

    res.status(201).json(nft);
  } catch (error) {
    console.error('Error minting NFT:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Purchase NFT
router.post('/:id/purchase', auth, async (req, res) => {
  try {
    const nft = await NFT.findById(req.params.id)
      .populate('creator', 'profile')
      .populate('currentOwner', 'profile');

    if (!nft) {
      return res.status(404).json({ message: 'NFT not found' });
    }

    if (nft.status !== 'listed') {
      return res.status(400).json({ message: 'NFT is not available for purchase' });
    }

    if (nft.currentOwner._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot purchase your own NFT' });
    }

    // In a real implementation, this would integrate with a payment processor
    // and blockchain transaction

    const seller = nft.currentOwner._id;
    const buyer = req.user.id;
    const salePrice = nft.price;

    // Calculate royalty for creator
    const royaltyAmount = (salePrice * nft.royaltyPercentage) / 100;
    const sellerAmount = salePrice - royaltyAmount;

    // Update NFT ownership
    nft.currentOwner = buyer;
    nft.transactionHistory.push({
      type: 'sale',
      buyer,
      seller,
      price: salePrice,
      timestamp: new Date()
    });

    await nft.save();

    // Populate the updated NFT
    await nft.populate('currentOwner', 'profile');

    res.json({
      nft,
      transaction: {
        buyer,
        seller,
        price: salePrice,
        royaltyAmount,
        sellerAmount
      }
    });
  } catch (error) {
    console.error('Error purchasing NFT:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update NFT price (owner only)
router.put('/:id/price', auth, async (req, res) => {
  try {
    const { price } = req.body;
    
    const nft = await NFT.findById(req.params.id);
    if (!nft) {
      return res.status(404).json({ message: 'NFT not found' });
    }

    if (nft.currentOwner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this NFT' });
    }

    nft.price = price;
    await nft.save();

    await nft.populate('creator', 'profile');
    await nft.populate('currentOwner', 'profile');
    await nft.populate('artwork', 'title images');

    res.json(nft);
  } catch (error) {
    console.error('Error updating NFT price:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List/Unlist NFT
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['listed', 'unlisted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const nft = await NFT.findById(req.params.id);
    if (!nft) {
      return res.status(404).json({ message: 'NFT not found' });
    }

    if (nft.currentOwner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this NFT' });
    }

    nft.status = status;
    await nft.save();

    await nft.populate('creator', 'profile');
    await nft.populate('currentOwner', 'profile');
    await nft.populate('artwork', 'title images');

    res.json(nft);
  } catch (error) {
    console.error('Error updating NFT status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's NFTs
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type = 'owned' } = req.query; // 'owned', 'created', or 'all'

    let filter = {};
    
    if (type === 'owned') {
      filter.currentOwner = userId;
    } else if (type === 'created') {
      filter.creator = userId;
    } else {
      filter.$or = [
        { currentOwner: userId },
        { creator: userId }
      ];
    }

    const nfts = await NFT.find(filter)
      .populate('creator', 'profile')
      .populate('currentOwner', 'profile')
      .populate('artwork', 'title images')
      .sort({ createdAt: -1 });

    res.json(nfts);
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
