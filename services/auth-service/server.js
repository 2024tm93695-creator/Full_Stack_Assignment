require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 5001;

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'Auth Service Running', port: PORT })
);

app.listen(PORT, () => console.log(`🔐 Auth Service     →  http://localhost:${PORT}`));
