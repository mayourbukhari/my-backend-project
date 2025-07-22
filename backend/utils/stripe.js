// Initialize Stripe only if the secret key is provided
let stripe = null;

const initializeStripe = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

/**
 * Create payment intent for order
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Payment intent
 */
const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const stripeInstance = initializeStripe();
    if (!stripeInstance) {
      throw new Error('Stripe not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
    }
    
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return paymentIntent;
  } catch (error) {
    throw new Error(`Payment intent creation failed: ${error.message}`);
  }
};

/**
 * Confirm payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Confirmed payment intent
 */
const confirmPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new Error(`Payment confirmation failed: ${error.message}`);
  }
};

/**
 * Retrieve payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Payment intent
 */
const retrievePaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new Error(`Payment retrieval failed: ${error.message}`);
  }
};

/**
 * Create refund for payment
 * @param {string} paymentIntentId - Payment intent ID
 * @param {number} amount - Amount to refund in cents (optional, full refund if not specified)
 * @param {string} reason - Refund reason
 * @returns {Promise<Object>} Refund object
 */
const createRefund = async (paymentIntentId, amount = null, reason = 'requested_by_customer') => {
  try {
    const refundData = {
      payment_intent: paymentIntentId,
      reason
    };
    
    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }
    
    const refund = await stripe.refunds.create(refundData);
    return refund;
  } catch (error) {
    throw new Error(`Refund creation failed: ${error.message}`);
  }
};

/**
 * Create Stripe customer
 * @param {Object} customerData - Customer information
 * @returns {Promise<Object>} Stripe customer
 */
const createCustomer = async (customerData) => {
  try {
    const customer = await stripe.customers.create(customerData);
    return customer;
  } catch (error) {
    throw new Error(`Customer creation failed: ${error.message}`);
  }
};

/**
 * Update Stripe customer
 * @param {string} customerId - Stripe customer ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated customer
 */
const updateCustomer = async (customerId, updateData) => {
  try {
    const customer = await stripe.customers.update(customerId, updateData);
    return customer;
  } catch (error) {
    throw new Error(`Customer update failed: ${error.message}`);
  }
};

/**
 * Calculate application fee for artist payments
 * @param {number} amount - Total amount
 * @param {number} feePercentage - Fee percentage (default 5%)
 * @returns {number} Application fee amount
 */
const calculateApplicationFee = (amount, feePercentage = 5) => {
  return Math.round(amount * (feePercentage / 100) * 100); // Convert to cents
};

/**
 * Create connected account for artist
 * @param {Object} accountData - Account information
 * @returns {Promise<Object>} Stripe account
 */
const createConnectedAccount = async (accountData) => {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: accountData.country || 'US',
      email: accountData.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        first_name: accountData.firstName,
        last_name: accountData.lastName,
        email: accountData.email,
      },
    });
    
    return account;
  } catch (error) {
    throw new Error(`Connected account creation failed: ${error.message}`);
  }
};

/**
 * Create account link for onboarding
 * @param {string} accountId - Stripe account ID
 * @param {string} returnUrl - Return URL after onboarding
 * @param {string} refreshUrl - Refresh URL if onboarding needs to be restarted
 * @returns {Promise<Object>} Account link
 */
const createAccountLink = async (accountId, returnUrl, refreshUrl) => {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });
    
    return accountLink;
  } catch (error) {
    throw new Error(`Account link creation failed: ${error.message}`);
  }
};

/**
 * Transfer funds to connected account
 * @param {string} accountId - Destination account ID
 * @param {number} amount - Amount to transfer in cents
 * @param {string} currency - Currency code
 * @returns {Promise<Object>} Transfer object
 */
const createTransfer = async (accountId, amount, currency = 'usd') => {
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      destination: accountId,
    });
    
    return transfer;
  } catch (error) {
    throw new Error(`Transfer creation failed: ${error.message}`);
  }
};

/**
 * Verify webhook signature
 * @param {string} payload - Request body
 * @param {string} signature - Stripe signature header
 * @param {string} endpointSecret - Webhook endpoint secret
 * @returns {Object} Verified event
 */
const verifyWebhookSignature = (payload, signature, endpointSecret) => {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    return event;
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
};

module.exports = {
  stripe,
  createPaymentIntent,
  confirmPaymentIntent,
  retrievePaymentIntent,
  createRefund,
  createCustomer,
  updateCustomer,
  calculateApplicationFee,
  createConnectedAccount,
  createAccountLink,
  createTransfer,
  verifyWebhookSignature
};
