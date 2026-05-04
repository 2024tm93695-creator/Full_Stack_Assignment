const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bookingSchema = new mongoose.Schema({
  bookingId:     { type: String, unique: true, default: () => uuidv4().slice(0, 8).toUpperCase() },
  userId:        { type: String, required: true, index: true },
  userName:      String,
  slotId:        { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingSlot', required: true },
  slotName:      String,
  slotCode:      String,
  slotAddress:   String,
  vehicleNumber: { type: String, required: true },
  vehicleType:   { type: String, enum: ['car', 'bike', 'truck'], required: true },
  startTime:     { type: Date, required: true },
  endTime:       { type: Date, required: true },
  duration:      Number,
  totalAmount:   { type: Number, required: true },
  status: {
    type: String,
    enum: ['confirmed', 'active', 'completed', 'cancelled', 'expired'],
    default: 'confirmed'
  },
  qrData:        String,
  otp:           { type: String, default: () => Math.floor(100000 + Math.random() * 900000).toString() },
  checkedIn:     { type: Boolean, default: false },
  checkedInAt:   Date,
  checkedOut:    { type: Boolean, default: false },
  checkedOutAt:  Date,
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'paid' }
}, { timestamps: true });

bookingSchema.index({ status: 1 });
bookingSchema.index({ startTime: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
