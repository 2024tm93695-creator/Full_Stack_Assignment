const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  slotCode:    { type: String, required: true, unique: true },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }  // [lng, lat]
  },
  address:     { type: String, required: true },
  area:        { type: String, required: true },
  city:        { type: String, default: 'Hyderabad' },
  vehicleTypes:  [{ type: String, enum: ['car', 'bike', 'truck'] }],
  totalSlots:    { type: Number, required: true },
  availableSlots:{ type: Number, required: true },
  reservedSlots: { type: Number, default: 0 },
  pricePerHour:  { type: Number, required: true },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'closed'],
    default: 'available'
  },
  facilities:  [String],
  rating:      { type: Number, default: 4.0, min: 0, max: 5 },
  totalRatings:{ type: Number, default: 0 },
  operatingHours: {
    open:      { type: String, default: '06:00' },
    close:     { type: String, default: '23:00' },
    is24Hours: { type: Boolean, default: false }
  },
  isOperational: { type: Boolean, default: true }
}, { timestamps: true });

parkingSlotSchema.index({ location: '2dsphere' });
parkingSlotSchema.index({ area: 1 });
parkingSlotSchema.index({ status: 1 });
parkingSlotSchema.index({ pricePerHour: 1 });

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema);
