require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const notifRoutes = require('./src/routes/notifications');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
const PORT   = process.env.NOTIFICATION_SERVICE_PORT || 5004;

connectDB();
app.use(cors());
app.use(express.json());
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`Notif client connected: ${socket.id}`);

  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined notifications room`);
  });

  socket.on('disconnect', () =>
    console.log(`Notif client disconnected: ${socket.id}`)
  );
});

app.use('/api/notifications', notifRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'Notification Service Running', port: PORT })
);

server.listen(PORT, () => console.log(`🔔 Notif Service    →  http://localhost:${PORT}`));
