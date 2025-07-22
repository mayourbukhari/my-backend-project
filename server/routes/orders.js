const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, isArtist } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');

// Protected routes - require authentication
router.post('/', auth, validateOrder, orderController.createOrder);
router.get('/', auth, orderController.getUserOrders);
router.get('/stats', auth, orderController.getOrderStats);
router.get('/:id', auth, orderController.getOrderById);
router.put('/:id/status', auth, orderController.updateOrderStatus);
router.post('/:id/confirm-payment', auth, orderController.confirmPayment);
router.put('/:id/cancel', auth, orderController.cancelOrder);

// Artist routes
router.get('/artist/orders', auth, isArtist, orderController.getArtistOrders);

module.exports = router;
