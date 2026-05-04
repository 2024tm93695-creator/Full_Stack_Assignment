const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const axios = require('axios');

const NOTIF_URL = process.env.NOTIF_SERVICE_URL || 'http://localhost:5004';

const notify = (payload) =>
  axios.post(`${NOTIF_URL}/api/notifications`, payload).catch(() => {});

const createBooking = async (req, res) => {
  const session = await Booking.startSession();
  session.startTransaction();
  try {
    const userId   = req.headers['x-user-id'];
    const userName = req.body.userName || 'User';
    const { slotId, vehicleNumber, vehicleType, startTime, endTime } = req.body;

    const slot = await ParkingSlot.findById(slotId).session(session);
    if (!slot) { await session.abortTransaction(); return res.status(404).json({ error: 'Parking slot not found' }); }
    if (slot.availableSlots <= 0) { await session.abortTransaction(); return res.status(400).json({ error: 'No available slots at this location' }); }

    const start    = new Date(startTime);
    const end      = new Date(endTime);
    const duration = Math.max(1, Math.ceil((end - start) / 3600000));
    const totalAmount = duration * slot.pricePerHour;

    const [booking] = await Booking.create([{
      userId, userName,
      slotId, slotName: slot.name, slotCode: slot.slotCode, slotAddress: slot.address,
      vehicleNumber, vehicleType, startTime: start, endTime: end, duration, totalAmount,
      qrData: `SMARTPARK|${slot.slotCode}|${Date.now()}`
    }], { session });

    slot.availableSlots -= 1;
    slot.reservedSlots  += 1;
    if (slot.availableSlots === 0) slot.status = 'occupied';
    else slot.status = 'reserved';
    await slot.save({ session });
    await session.commitTransaction();

    notify({
      userId, type: 'booking_confirmed', priority: 'high',
      title: 'Booking Confirmed!',
      message: `Your slot at ${slot.name} is reserved. OTP: ${booking.otp}. Amount: ₹${totalAmount}`,
      data: { bookingId: booking.bookingId }
    });

    res.status(201).json(booking);
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

const getUserBookings = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { userId };
    if (status) filter.status = status;
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('slotId', 'name address area location rating')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Booking.countDocuments(filter)
    ]);
    res.json({ bookings, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const cancelBooking = async (req, res) => {
  const session = await Booking.startSession();
  session.startTransaction();
  try {
    const userId  = req.headers['x-user-id'];
    const booking = await Booking.findOne({ _id: req.params.id, userId }).session(session);
    if (!booking) { await session.abortTransaction(); return res.status(404).json({ error: 'Booking not found' }); }
    if (['completed', 'cancelled'].includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Cannot cancel this booking' });
    }
    booking.status = 'cancelled';
    await booking.save({ session });
    await ParkingSlot.findByIdAndUpdate(
      booking.slotId,
      { $inc: { availableSlots: 1, reservedSlots: -1 } },
      { session }
    );
    await session.commitTransaction();

    notify({
      userId, type: 'booking_cancelled', priority: 'medium',
      title: 'Booking Cancelled',
      message: `Your booking at ${booking.slotName} has been cancelled. Refund initiated.`,
      data: { bookingId: booking.bookingId }
    });

    res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

const checkIn = async (req, res) => {
  try {
    const { otp } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking)          return res.status(404).json({ error: 'Booking not found' });
    if (booking.otp !== otp) return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    if (booking.checkedIn) return res.status(400).json({ error: 'Already checked in' });
    booking.checkedIn  = true;
    booking.checkedInAt = new Date();
    booking.status     = 'active';
    await booking.save();
    res.json({ message: 'Check-in successful! Enjoy your parking.', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkOut = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)           return res.status(404).json({ error: 'Booking not found' });
    if (!booking.checkedIn) return res.status(400).json({ error: 'Not checked in yet' });
    booking.checkedOut   = true;
    booking.checkedOutAt = new Date();
    booking.status       = 'completed';
    await booking.save();
    await ParkingSlot.findByIdAndUpdate(booking.slotId, {
      $inc: { availableSlots: 1, reservedSlots: -1 }
    });
    res.json({ message: 'Check-out successful!', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = status ? { status } : {};
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('slotId', 'name area')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Booking.countDocuments(filter)
    ]);
    res.json({ bookings, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBookingStats = async (req, res) => {
  try {
    const [byStatus, revenue] = await Promise.all([
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { status: { $in: ['confirmed', 'active', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ])
    ]);
    res.json({ byStatus, revenue: revenue[0] || { total: 0, count: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createBooking, getUserBookings, cancelBooking, checkIn, checkOut, getAllBookings, getBookingStats };
