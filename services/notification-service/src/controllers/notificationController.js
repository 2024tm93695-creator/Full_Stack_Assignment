const Notification = require('../models/Notification');

const getNotifications = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const filter = { userId };
    if (unreadOnly === 'true') filter.isRead = false;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false })
    ]);
    res.json({ notifications, total, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, data, priority } = req.body;
    const notification = await Notification.create({ userId, type, title, message, data, priority });
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('notification:new', notification);
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id, { isRead: true }, { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markAllRead = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getNotifications, createNotification, markAsRead, markAllRead, deleteNotification };
