const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
jest.mock('axios');                              // prevent real HTTP to notif service
const axios = require('axios');
axios.post.mockResolvedValue({ data: {} });

const bookingRoutes = require('../src/routes/booking');
const parkingRoutes = require('../src/routes/parking');
const ParkingSlot   = require('../src/models/ParkingSlot');

let mongod;
const app = express();
app.use(express.json());
app.use('/api/parking/slots',    parkingRoutes);
app.use('/api/parking/bookings', bookingRoutes);

const USER_ID   = new mongoose.Types.ObjectId().toString();
const USER_NAME = 'Test User';

const SLOT_DATA = {
  name: 'HITEC City Parking A', slotCode: 'HCP-001',
  area: 'HITEC City', address: 'Plot 12, HITEC City',
  totalSlots: 10, availableSlots: 10, pricePerHour: 30,
  vehicleTypes: ['car', 'bike'],
  location: { type: 'Point', coordinates: [78.3733, 17.4435] }
};

const startTime = new Date(Date.now() + 3600000).toISOString();
const endTime   = new Date(Date.now() + 7200000).toISOString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const key in cols) await cols[key].deleteMany({});
  axios.post.mockClear();
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const createSlot = () =>
  request(app).post('/api/parking/slots').send(SLOT_DATA);

const createBooking = (slotId, overrides = {}) =>
  request(app).post('/api/parking/bookings')
    .set('x-user-id', USER_ID)
    .send({ slotId, vehicleNumber: 'TS09AB1234', vehicleType: 'car',
            startTime, endTime, userName: USER_NAME, ...overrides });

// ─── Create Booking ───────────────────────────────────────────────────────────
describe('POST /api/parking/bookings', () => {
  test('creates booking, reduces availableSlots, fires notification', async () => {
    const { body: slot } = await createSlot();
    const res = await createBooking(slot._id);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('bookingId');
    expect(res.body).toHaveProperty('otp');
    expect(res.body.status).toBe('confirmed');
    expect(res.body.totalAmount).toBe(30);        // 1 hr × ₹30

    const updated = await ParkingSlot.findById(slot._id);
    expect(updated.availableSlots).toBe(9);
    expect(axios.post).toHaveBeenCalledTimes(1);  // notification sent
  });

  test('returns 404 for unknown slotId', async () => {
    const res = await createBooking(new mongoose.Types.ObjectId().toString());
    expect(res.status).toBe(404);
  });

  test('returns 400 when no slots available', async () => {
    const { body: slot } = await createSlot();
    await ParkingSlot.findByIdAndUpdate(slot._id, { availableSlots: 0 });
    const res = await createBooking(slot._id);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no available/i);
  });
});

// ─── Get User Bookings ────────────────────────────────────────────────────────
describe('GET /api/parking/bookings', () => {
  test('returns bookings for the requesting user', async () => {
    const { body: slot } = await createSlot();
    await createBooking(slot._id);
    const res = await request(app).get('/api/parking/bookings')
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBe(1);
    expect(res.body.bookings[0].userId).toBe(USER_ID);
  });

  test('filters by status', async () => {
    const { body: slot } = await createSlot();
    await createBooking(slot._id);
    const res = await request(app).get('/api/parking/bookings?status=confirmed')
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(200);
    expect(res.body.bookings.every(b => b.status === 'confirmed')).toBe(true);
  });

  test('returns empty list for user with no bookings', async () => {
    const res = await request(app).get('/api/parking/bookings')
      .set('x-user-id', new mongoose.Types.ObjectId().toString());
    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBe(0);
  });
});

// ─── Cancel Booking ───────────────────────────────────────────────────────────
describe('PUT /api/parking/bookings/:id/cancel', () => {
  test('cancels a confirmed booking and restores slot count', async () => {
    const { body: slot } = await createSlot();
    const { body: booking } = await createBooking(slot._id);

    const res = await request(app).put(`/api/parking/bookings/${booking._id}/cancel`)
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('cancelled');

    const updated = await ParkingSlot.findById(slot._id);
    expect(updated.availableSlots).toBe(10);
  });

  test('cannot cancel a completed booking', async () => {
    const { body: slot } = await createSlot();
    const { body: booking } = await createBooking(slot._id);
    const Booking = require('../src/models/Booking');
    await Booking.findByIdAndUpdate(booking._id, { status: 'completed' });

    const res = await request(app).put(`/api/parking/bookings/${booking._id}/cancel`)
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(400);
  });
});

// ─── Check-In ─────────────────────────────────────────────────────────────────
describe('POST /api/parking/bookings/:id/checkin', () => {
  test('checks in with correct OTP, status becomes active', async () => {
    const { body: slot } = await createSlot();
    const { body: booking } = await createBooking(slot._id);

    const res = await request(app)
      .post(`/api/parking/bookings/${booking._id}/checkin`)
      .set('x-user-id', USER_ID)
      .send({ otp: booking.otp });
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('active');
    expect(res.body.booking.checkedIn).toBe(true);
  });

  test('rejects wrong OTP', async () => {
    const { body: slot } = await createSlot();
    const { body: booking } = await createBooking(slot._id);

    const res = await request(app)
      .post(`/api/parking/bookings/${booking._id}/checkin`)
      .set('x-user-id', USER_ID)
      .send({ otp: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid otp/i);
  });

  test('rejects double check-in', async () => {
    const { body: slot } = await createSlot();
    const { body: booking } = await createBooking(slot._id);
    await request(app).post(`/api/parking/bookings/${booking._id}/checkin`)
      .set('x-user-id', USER_ID).send({ otp: booking.otp });

    const res = await request(app).post(`/api/parking/bookings/${booking._id}/checkin`)
      .set('x-user-id', USER_ID).send({ otp: booking.otp });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already checked in/i);
  });
});

// ─── Check-Out ────────────────────────────────────────────────────────────────
describe('POST /api/parking/bookings/:id/checkout', () => {
  test('checks out, status becomes completed, slot freed', async () => {
    const { body: slot }    = await createSlot();
    const { body: booking } = await createBooking(slot._id);

    await request(app).post(`/api/parking/bookings/${booking._id}/checkin`)
      .set('x-user-id', USER_ID).send({ otp: booking.otp });

    const res = await request(app)
      .post(`/api/parking/bookings/${booking._id}/checkout`)
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('completed');
    expect(res.body.booking.checkedOut).toBe(true);

    const updated = await ParkingSlot.findById(slot._id);
    expect(updated.availableSlots).toBe(10);
  });
});

// ─── Booking Stats ────────────────────────────────────────────────────────────
describe('GET /api/parking/bookings/stats', () => {
  test('returns revenue and status breakdown', async () => {
    const { body: slot } = await createSlot();
    await createBooking(slot._id);
    const res = await request(app).get('/api/parking/bookings/stats')
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('byStatus');
    expect(res.body).toHaveProperty('revenue');
    expect(res.body.revenue.total).toBeGreaterThan(0);
  });
});
