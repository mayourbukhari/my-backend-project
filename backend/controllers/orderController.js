const Order = require('../models/Order');
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const { createPaymentOrder, verifyPaymentSignature } = require('../utils/razorpay');
const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } = require('../utils/email');

// Create new order
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, billingAddress, paymentMethod } = req.body;
    const customerId = req.user._id;

    // Validate and fetch artworks
    const artworkIds = items.map(item => item.artwork);
    const artworks = await Artwork.find({ 
      _id: { $in: artworkIds },
      availability: 'available',
      status: 'published'
    }).populate('artist', '_id');

    if (artworks.length !== items.length) {
      return res.status(400).json({ message: 'Some artworks are no longer available' });
    }

    // Calculate order totals
    let subtotal = 0;
    let shippingTotal = 0;
    const orderItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const artwork = artworks.find(art => art._id.toString() === item.artwork);
      
      if (!artwork) {
        return res.status(400).json({ message: `Artwork ${item.artwork} not found` });
      }

      const itemPrice = artwork.price;
      const quantity = item.quantity || 1;
      const itemShipping = artwork.shipping?.cost || 0;

      subtotal += itemPrice * quantity;
      shippingTotal += itemShipping;

      orderItems.push({
        artwork: artwork._id,
        artist: artwork.artist._id,
        price: itemPrice,
        quantity,
        shippingCost: itemShipping
      });
    }

    // Calculate tax (simplified - you might want to use a tax service)
    const taxRate = 0.08; // 8% tax rate
    const taxAmount = subtotal * taxRate;
    const total = subtotal + shippingTotal + taxAmount;

    // Create payment intent with Stripe
    const paymentIntent = await createPaymentIntent(total, 'usd', {
      customer_id: customerId.toString(),
      order_type: 'artwork_purchase'
    });

    // Create order
    const orderData = {
      customer: customerId,
      items: orderItems,
      subtotal,
      shippingTotal,
      taxAmount,
      total,
      paymentMethod,
      paymentIntent: paymentIntent.id,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress
    };

    const order = new Order(orderData);
    await order.save();

    // Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'profile email')
      .populate('items.artwork', 'title images price')
      .populate('items.artist', 'artistProfile.name profile.firstName profile.lastName');

    res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error while creating order' });
  }
};

// Get user orders
const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user._id;

    const filter = { customer: userId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('items.artwork', 'title images price')
        .populate('items.artist', 'artistProfile.name profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(filter)
    ]);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};

// Get artist orders
const getArtistOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const artistId = req.user._id;

    const filter = { 'items.artist': artistId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'profile email')
        .populate('items.artwork', 'title images price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(filter)
    ]);

    // Filter items to only show artist's items
    const filteredOrders = orders.map(order => ({
      ...order.toObject(),
      items: order.items.filter(item => item.artist.toString() === artistId.toString())
    }));

    res.json({
      orders: filteredOrders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get artist orders error:', error);
    res.status(500).json({ message: 'Server error while fetching artist orders' });
  }
};

// Get single order
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(id)
      .populate('customer', 'profile email')
      .populate('items.artwork', 'title images price description')
      .populate('items.artist', 'artistProfile.name profile.firstName profile.lastName');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user has access to this order
    const isCustomer = order.customer._id.toString() === userId.toString();
    const isArtist = order.items.some(item => item.artist._id.toString() === userId.toString());
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isArtist && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error while fetching order' });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note, trackingNumber } = req.body;
    const userId = req.user._id;

    const order = await Order.findById(id)
      .populate('customer', 'profile email')
      .populate('items.artist', '_id');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user can update this order
    const isArtist = order.items.some(item => item.artist._id.toString() === userId.toString());
    const isAdmin = req.user.role === 'admin';

    if (!isArtist && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update order status
    await order.addStatusUpdate(status, note, userId);

    // Update tracking number if provided
    if (trackingNumber) {
      order.shipping = order.shipping || {};
      order.shipping.trackingNumber = trackingNumber;
      await order.save();
    }

    // Update artwork availability if order is confirmed
    if (status === 'confirmed' && order.status === 'pending') {
      const artworkIds = order.items.map(item => item.artwork);
      await Artwork.updateMany(
        { _id: { $in: artworkIds } },
        { availability: 'sold' }
      );
    }

    // Send email notification to customer
    try {
      await sendOrderStatusUpdateEmail(
        order.customer.email,
        order.customer.profile?.firstName || 'Customer',
        order
      );
    } catch (emailError) {
      console.error('Status update email failed:', emailError);
    }

    const updatedOrder = await Order.findById(id)
      .populate('customer', 'profile email')
      .populate('items.artwork', 'title images price')
      .populate('items.artist', 'artistProfile.name profile.firstName profile.lastName');

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error while updating order status' });
  }
};

// Confirm payment
const confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentIntentId } = req.body;

    const order = await Order.findById(id)
      .populate('customer', 'profile email')
      .populate('items.artwork', 'title');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns this order
    if (order.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify payment with Stripe
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();

      // Update artwork availability
      const artworkIds = order.items.map(item => item.artwork._id);
      await Artwork.updateMany(
        { _id: { $in: artworkIds } },
        { availability: 'sold' }
      );

      // Send confirmation email
      try {
        await sendOrderConfirmationEmail(
          order.customer.email,
          order.customer.profile?.firstName || 'Customer',
          order
        );
      } catch (emailError) {
        console.error('Confirmation email failed:', emailError);
      }

      res.json({
        message: 'Payment confirmed successfully',
        order
      });
    } else {
      res.status(400).json({ message: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Server error while confirming payment' });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const order = await Order.findById(id)
      .populate('customer', 'profile email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user can cancel this order
    const isCustomer = order.customer._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
    }

    // Update order status
    await order.addStatusUpdate('cancelled', reason, userId);

    // Make artworks available again
    const artworkIds = order.items.map(item => item.artwork);
    await Artwork.updateMany(
      { _id: { $in: artworkIds } },
      { availability: 'available' }
    );

    res.json({
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Server error while cancelling order' });
  }
};

// Get order statistics for dashboard
const getOrderStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { role } = req.user;

    let matchCondition;
    if (role === 'artist') {
      matchCondition = { 'items.artist': userId };
    } else if (role === 'admin') {
      matchCondition = {};
    } else {
      matchCondition = { customer: userId };
    }

    const stats = await Order.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      stats: stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0
      }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ message: 'Server error while fetching order statistics' });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getArtistOrders,
  getOrderById,
  updateOrderStatus,
  confirmPayment,
  cancelOrder,
  getOrderStats
};
