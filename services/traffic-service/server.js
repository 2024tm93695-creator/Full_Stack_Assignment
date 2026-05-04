require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const trafficRoutes = require('./src/routes/traffic');
const { startIoTSimulation } = require('./src/simulation/iotSimulator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.TRAFFIC_SERVICE_PORT || 5003;

connectDB();
app.use(cors());
app.use(express.json());
app.set('io', io);

app.use('/api/traffic', trafficRoutes);

io.on('connection', (socket) => {
  console.log(`Traffic client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Traffic client disconnected: ${socket.id}`));
});

startIoTSimulation(io);

app.get('/health', (req, res) =>
  res.json({ status: 'Traffic Service Running', port: PORT })
);

server.listen(PORT, () => console.log(`🚦 Traffic Service  →  http://localhost:${PORT}`));
