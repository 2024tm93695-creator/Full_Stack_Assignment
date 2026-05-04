const ParkingSlot = require('../models/ParkingSlot');

const getAllSlots = async (req, res) => {
  try {
    const { area, vehicleType, status, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    const filter = { isOperational: true };
    if (area)        filter.area = new RegExp(area, 'i');
    if (vehicleType) filter.vehicleTypes = vehicleType;
    if (status)      filter.status = status;
    if (minPrice || maxPrice) {
      filter.pricePerHour = {};
      if (minPrice) filter.pricePerHour.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerHour.$lte = Number(maxPrice);
    }
    const [slots, total] = await Promise.all([
      ParkingSlot.find(filter)
        .skip((page - 1) * limit).limit(Number(limit))
        .sort({ availableSlots: -1 }),
      ParkingSlot.countDocuments(filter)
    ]);
    res.json({ slots, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getNearbySlots = async (req, res) => {
  try {
    const { lat, lng, radius = 5000, vehicleType } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });
    const filter = {
      isOperational: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: Number(radius)
        }
      }
    };
    if (vehicleType) filter.vehicleTypes = vehicleType;
    const slots = await ParkingSlot.find(filter).limit(20);
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getSlotById = async (req, res) => {
  try {
    const slot = await ParkingSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createSlot = async (req, res) => {
  try {
    const slot = await ParkingSlot.create(req.body);
    res.status(201).json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateSlot = async (req, res) => {
  try {
    const slot = await ParkingSlot.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteSlot = async (req, res) => {
  try {
    await ParkingSlot.findByIdAndDelete(req.params.id);
    res.json({ message: 'Slot deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getStats = async (req, res) => {
  try {
    const agg = await ParkingSlot.aggregate([
      {
        $group: {
          _id: null,
          totalSlots:       { $sum: '$totalSlots' },
          availableSlots:   { $sum: '$availableSlots' },
          reservedSlots:    { $sum: '$reservedSlots' },
          totalLocations:   { $sum: 1 },
          avgPrice:         { $avg: '$pricePerHour' }
        }
      }
    ]);
    const byStatus = await ParkingSlot.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    res.json({ ...(agg[0] || {}), byStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllSlots, getNearbySlots, getSlotById, createSlot, updateSlot, deleteSlot, getStats };
