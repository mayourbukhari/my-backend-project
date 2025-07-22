const axios = require('axios');

// Configure Brevo API
const brevoApiUrl = 'https://api.brevo.com/v3';
const brevoApiKey = process.env.BREVO_API_KEY;

/**
 * Send email using Brevo
 * @param {Object} emailData - Email configuration
 * @returns {Promise} Brevo response
 */
const sendEmail = async (emailData) => {
  try {
    const payload = {
      sender: {
        name: 'Artist Marketplace',
        email: process.env.FROM_EMAIL || 'noreply@artistmarketplace.com'
      },
      to: [
        {
          email: emailData.to,
          name: emailData.name || ''
        }
      ],
      subject: emailData.subject,
      htmlContent: emailData.html,
      ...(emailData.textContent && { textContent: emailData.textContent })
    };

    const response = await axios.post(`${brevoApiUrl}/smtp/email`, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      }
    });

    console.log('Email sent successfully:', response.status);
    return response.data;
  } catch (error) {
    console.error('Email sending failed:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send welcome email to new users
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} role - User role
 */
const sendWelcomeEmail = async (email, name, role = 'user') => {
  const subject = 'Welcome to Artist Marketplace!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Welcome to Artist Marketplace!</h1>
      <p>Dear ${name},</p>
      <p>Thank you for joining Artist Marketplace! We're excited to have you as part of our creative community.</p>
      
      ${role === 'artist' ? `
        <p>As an artist, you can now:</p>
        <ul>
          <li>Create your professional portfolio</li>
          <li>Upload and sell your artwork</li>
          <li>Connect with art collectors worldwide</li>
          <li>Track your sales and analytics</li>
        </ul>
      ` : `
        <p>As an art enthusiast, you can now:</p>
        <ul>
          <li>Discover amazing artwork from talented artists</li>
          <li>Build your personal art collection</li>
          <li>Follow your favorite artists</li>
          <li>Make secure purchases with buyer protection</li>
        </ul>
      `}
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
          Start Exploring
        </a>
      </div>
      
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best regards,<br>The Artist Marketplace Team</p>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject,
    html
  });
};

/**
 * Send email verification
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} token - Verification token
 */
const sendVerificationEmail = async (email, name, token) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  const subject = 'Verify Your Email Address';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Verify Your Email</h1>
      <p>Hello ${name},</p>
      <p>Please click the button below to verify your email address:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
          Verify Email
        </a>
      </div>
      
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all;">${verificationUrl}</p>
      
      <p>This link will expire in 24 hours.</p>
      <p>Best regards,<br>The Artist Marketplace Team</p>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject,
    html
  });
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} token - Reset token
 */
const sendPasswordResetEmail = async (email, name, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  const subject = 'Reset Your Password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Reset Your Password</h1>
      <p>Hello ${name},</p>
      <p>You requested a password reset. Click the button below to create a new password:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
          Reset Password
        </a>
      </div>
      
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all;">${resetUrl}</p>
      
      <p>This link will expire in 1 hour. If you didn't request this reset, please ignore this email.</p>
      <p>Best regards,<br>The Artist Marketplace Team</p>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject,
    html
  });
};

/**
 * Send order confirmation email
 * @param {string} email - Customer email
 * @param {string} name - Customer name
 * @param {Object} order - Order details
 */
const sendOrderConfirmationEmail = async (email, name, order) => {
  const subject = `Order Confirmation - ${order.orderNumber}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Order Confirmation</h1>
      <p>Dear ${name},</p>
      <p>Thank you for your order! Here are the details:</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Order #${order.orderNumber}</h3>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
        <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
        <p><strong>Status:</strong> ${order.status}</p>
      </div>
      
      <h3>Items Ordered:</h3>
      ${order.items.map(item => `
        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
          <p><strong>${item.artwork.title}</strong></p>
          <p>Price: $${item.price.toFixed(2)}</p>
        </div>
      `).join('')}
      
      <p>We'll send you another email when your order ships.</p>
      <p>Best regards,<br>The Artist Marketplace Team</p>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject,
    html
  });
};

/**
 * Send order status update email
 * @param {string} email - Customer email
 * @param {string} name - Customer name
 * @param {Object} order - Order details
 */
const sendOrderStatusUpdateEmail = async (email, name, order) => {
  const subject = `Order Update - ${order.orderNumber}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Order Status Update</h1>
      <p>Dear ${name},</p>
      <p>Your order status has been updated:</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Order #${order.orderNumber}</h3>
        <p><strong>Status:</strong> ${order.status}</p>
        ${order.shipping?.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.shipping.trackingNumber}</p>` : ''}
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/orders/${order._id}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
          View Order Details
        </a>
      </div>
      
      <p>Best regards,<br>The Artist Marketplace Team</p>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject,
    html
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail
};
