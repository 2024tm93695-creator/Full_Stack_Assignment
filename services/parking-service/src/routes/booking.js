const express = require('express');
const {
  createBooking, getUserBookings, cancelBooking,
  checkIn, checkOut, getAllBookings, getBookingStats
} = require('../controllers/bookingController');

const router = express.Router();

router.get('/stats',          getBookingStats);
router.get('/all',            getAllBookings);
router.get('/',               getUserBookings);
router.post('/',              createBooking);
router.put('/:id/cancel',     cancelBooking);
router.post('/:id/checkin',   checkIn);
router.post('/:id/checkout',  checkOut);

module.exports = router;
