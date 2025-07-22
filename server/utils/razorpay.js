const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance only if keys are provided
let razorpay = null;

const initializeRazorpay = () => {
  if (!razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

/**
 * Create payment order
 * @param {number} amount - Amount in rupees
 * @param {string} currency - Currency code (default: INR)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Payment order
 */
const createPaymentOrder = async (amount, currency = 'INR', metadata = {}) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const options = {
      amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: metadata,
    };

    const order = await razorpayInstance.orders.create(options);
    return order;
  } catch (error) {
    throw new Error(`Payment order creation failed: ${error.message}`);
  }
};

/**
 * Verify payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Payment signature
 * @returns {boolean} Verification result
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    throw new Error(`Payment verification failed: ${error.message}`);
  }
};

/**
 * Capture payment
 * @param {string} paymentId - Payment ID
 * @param {number} amount - Amount to capture in paise
 * @returns {Promise<Object>} Captured payment
 */
const capturePayment = async (paymentId, amount) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const payment = await razorpayInstance.payments.capture(paymentId, amount);
    return payment;
  } catch (error) {
    throw new Error(`Payment capture failed: ${error.message}`);
  }
};

/**
 * Get payment details
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Payment details
 */
const getPaymentDetails = async (paymentId) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
};

/**
 * Refund payment
 * @param {string} paymentId - Payment ID
 * @param {number} amount - Refund amount in paise
 * @param {Object} notes - Additional notes
 * @returns {Promise<Object>} Refund details
 */
const refundPayment = async (paymentId, amount, notes = {}) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const refund = await razorpayInstance.payments.refund(paymentId, {
      amount,
      notes,
    });
    return refund;
  } catch (error) {
    throw new Error(`Payment refund failed: ${error.message}`);
  }
};

/**
 * Create subscription
 * @param {Object} subscriptionData - Subscription details
 * @returns {Promise<Object>} Subscription details
 */
const createSubscription = async (subscriptionData) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const subscription = await razorpayInstance.subscriptions.create(subscriptionData);
    return subscription;
  } catch (error) {
    throw new Error(`Subscription creation failed: ${error.message}`);
  }
};

/**
 * Cancel subscription
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Cancelled subscription
 */
const cancelSubscription = async (subscriptionId) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const subscription = await razorpayInstance.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    throw new Error(`Subscription cancellation failed: ${error.message}`);
  }
};

/**
 * Create customer
 * @param {Object} customerData - Customer details
 * @returns {Promise<Object>} Customer details
 */
const createCustomer = async (customerData) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const customer = await razorpayInstance.customers.create(customerData);
    return customer;
  } catch (error) {
    throw new Error(`Customer creation failed: ${error.message}`);
  }
};

/**
 * Create transfer (for marketplace payments)
 * @param {Object} transferData - Transfer details
 * @returns {Promise<Object>} Transfer details
 */
const createTransfer = async (transferData) => {
  try {
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.');
    }
    
    const transfer = await razorpayInstance.transfers.create(transferData);
    return transfer;
  } catch (error) {
    throw new Error(`Transfer creation failed: ${error.message}`);
  }
};

/**
 * Verify webhook signature
 * @param {string} body - Webhook body
 * @param {string} signature - Webhook signature
 * @returns {boolean} Verification result
 */
const verifyWebhookSignature = (body, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    throw new Error(`Webhook verification failed: ${error.message}`);
  }
};

module.exports = {
  razorpay,
  createPaymentOrder,
  verifyPaymentSignature,
  capturePayment,
  getPaymentDetails,
  refundPayment,
  createSubscription,
  cancelSubscription,
  createCustomer,
  createTransfer,
  verifyWebhookSignature,
};
