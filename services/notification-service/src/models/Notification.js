const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:   { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['booking_confirmed', 'booking_cancelled', 'slot_available', 'congestion_alert', 'reminder', 'info'],
    default: 'info'
  },
  title:    { type: String, required: true },
  message:  { type: String, required: true },
  isRead:   { type: Boolean, default: false },
  data:     mongoose.Schema.Types.Mixed,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
