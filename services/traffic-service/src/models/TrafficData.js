const mongoose = require('mongoose');

const trafficDataSchema = new mongoose.Schema({
  roadName:      { type: String, required: true },
  area:          { type: String, required: true },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  congestionLevel: {
    type: String,
    enum: ['free', 'moderate', 'heavy', 'severe'],
    default: 'free'
  },
  congestionScore: { type: Number, min: 0, max: 100, default: 0 },
  averageSpeed:    { type: Number, default: 60 },
  normalSpeed:     { type: Number, default: 60 },
  vehicleCount:    { type: Number, default: 0 },
  incidentType: {
    type: String,
    enum: ['none', 'accident', 'roadwork', 'event', 'breakdown'],
    default: 'none'
  },
  incidentDescription: String,
  etaDelay:    { type: Number, default: 0 },
  timestamp:   { type: Date, default: Date.now, index: true }
});

trafficDataSchema.index({ location: '2dsphere' });
trafficDataSchema.index({ area: 1 });
trafficDataSchema.index({ timestamp: -1 });

module.exports = mongoose.model('TrafficData', trafficDataSchema);
