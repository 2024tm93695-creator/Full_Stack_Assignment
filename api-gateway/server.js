require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
const PORT = process.env.PORT || 5000;

const AUTH_SERVICE    = process.env.AUTH_SERVICE_URL    || 'http://localhost:5001';
const PARKING_SERVICE = process.env.PARKING_SERVICE_URL || 'http://localhost:5002';
const TRAFFIC_SERVICE = process.env.TRAFFIC_SERVICE_URL || 'http://localhost:5003';
const NOTIF_SERVICE   = process.env.NOTIF_SERVICE_URL   || 'http://localhost:5004';

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests. Please try again later.' }
});
app.use(limiter);

const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  try {
    const decoded = jwt.verify(
      auth.substring(7),
      process.env.JWT_SECRET || 'smartpark_jwt_secret_2024'
    );
    req.headers['x-user-id']   = decoded.id;
    req.headers['x-user-role'] = decoded.role || 'user';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const proxyOpts = (target) => ({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      res.status(502).json({ error: `Service unavailable: ${err.message}` });
    }
  }
});

// Swagger UI — available at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'SmartPark API Docs',
  swaggerOptions: { persistAuthorization: true }
}));

// Auth routes — public
app.use('/api/auth', createProxyMiddleware(proxyOpts(AUTH_SERVICE)));

// Parking slots — GET is public, mutations require auth
app.use('/api/parking/slots', (req, res, next) => {
  if (req.method === 'GET') return next();
  verifyToken(req, res, next);
}, createProxyMiddleware(proxyOpts(PARKING_SERVICE)));

// Booking routes — always protected
app.use('/api/parking/bookings', verifyToken, createProxyMiddleware(proxyOpts(PARKING_SERVICE)));

// Traffic — public
app.use('/api/traffic', createProxyMiddleware(proxyOpts(TRAFFIC_SERVICE)));

// Notifications — protected
app.use('/api/notifications', verifyToken, createProxyMiddleware(proxyOpts(NOTIF_SERVICE)));

app.get('/health', (req, res) => res.json({
  status: 'API Gateway Running',
  timestamp: new Date().toISOString(),
  services: { AUTH_SERVICE, PARKING_SERVICE, TRAFFIC_SERVICE, NOTIF_SERVICE }
}));

app.listen(PORT, () => {
  console.log(`\n🚀 API Gateway  →  http://localhost:${PORT}`);
  console.log(`   Auth Service   →  ${AUTH_SERVICE}`);
  console.log(`   Parking Service→  ${PARKING_SERVICE}`);
  console.log(`   Traffic Service→  ${TRAFFIC_SERVICE}`);
  console.log(`   Notif Service  →  ${NOTIF_SERVICE}`);
  console.log(`   Swagger Docs   →  http://localhost:${PORT}/api-docs\n`);
});
