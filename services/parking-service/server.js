require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const parkingRoutes = require('./src/routes/parking');
const bookingRoutes = require('./src/routes/booking');

const app = express();
const PORT = process.env.PARKING_SERVICE_PORT || 5002;

connectDB();
app.use(cors());
app.use(express.json());

app.use('/api/parking/slots',    parkingRoutes);
app.use('/api/parking/bookings', bookingRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'Parking Service Running', port: PORT })
);

app.listen(PORT, () => console.log(`🅿️  Parking Service  →  http://localhost:${PORT}`));
