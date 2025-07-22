# Artist Marketplace - Backend

This is the backend (server-side) API for the Artist Marketplace, built with Node.js and Express.

## Deployment on Render

This folder contains the Express.js backend API that should be deployed to Render.

### Environment Variables Needed

Make sure to set these environment variables in your Render deployment:

- `PORT` - Port number (Render will set this automatically)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `STRIPE_SECRET_KEY` - Stripe secret key
- `RAZORPAY_KEY_ID` - Razorpay key ID
- `RAZORPAY_KEY_SECRET` - Razorpay secret key
- `EMAIL_HOST` - Email service host
- `EMAIL_PORT` - Email service port
- `EMAIL_USER` - Email username
- `EMAIL_PASS` - Email password

### Build Command

```
npm install
```

### Start Command

```
npm start
```

## Local Development

```bash
npm install
npm run dev
```

The API will run on `http://localhost:5000`
