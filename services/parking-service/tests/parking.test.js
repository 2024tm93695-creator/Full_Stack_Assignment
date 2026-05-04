const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const parkingRoutes = require('../src/routes/parking');

let mongod;
const app = express();
app.use(express.json());
app.use('/api/parking/slots', parkingRoutes);

const SLOT = {
  name: 'HITEC City Parking A',
  slotCode: 'HCP-001',
  area: 'HITEC City',
  address: 'Plot 12, HITEC City',
  totalSlots: 100,
  availableSlots: 100,
  pricePerHour: 30,
  vehicleTypes: ['car', 'bike'],
  facilities: ['CCTV', 'Security'],
  location: { type: 'Point', coordinates: [78.3733, 17.4435] }
};

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
});

// ─── Create Slot ──────────────────────────────────────────────────────────────
describe('POST /api/parking/slots', () => {
  test('creates a parking slot', async () => {
    const res = await request(app).post('/api/parking/slots').send(SLOT);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('HITEC City Parking A');
    expect(res.body.availableSlots).toBe(100);
    expect(res.body.isOperational).toBe(true);
  });

  test('rejects slot with missing required fields', async () => {
    const res = await request(app).post('/api/parking/slots')
      .send({ name: 'Incomplete Slot' });
    expect(res.status).toBe(400);
  });

  test('rejects duplicate slotCode', async () => {
    await request(app).post('/api/parking/slots').send(SLOT);
    const res = await request(app).post('/api/parking/slots').send(SLOT);
    expect(res.status).toBe(400);
  });
});

// ─── Get All Slots ────────────────────────────────────────────────────────────
describe('GET /api/parking/slots', () => {
  beforeEach(async () => {
    await request(app).post('/api/parking/slots').send(SLOT);
    await request(app).post('/api/parking/slots').send({
      ...SLOT, slotCode: 'MDP-001', name: 'Madhapur Parking', area: 'Madhapur',
      pricePerHour: 20, vehicleTypes: ['bike']
    });
  });

  test('returns all operational slots', async () => {
    const res = await request(app).get('/api/parking/slots');
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBe(2);
    expect(res.body.total).toBe(2);
  });

  test('filters by area', async () => {
    const res = await request(app).get('/api/parking/slots?area=Madhapur');
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBe(1);
    expect(res.body.slots[0].area).toBe('Madhapur');
  });

  test('filters by vehicleType', async () => {
    const res = await request(app).get('/api/parking/slots?vehicleType=bike');
    expect(res.status).toBe(200);
    expect(res.body.slots.every(s => s.vehicleTypes.includes('bike'))).toBe(true);
  });

  test('filters by maxPrice', async () => {
    const res = await request(app).get('/api/parking/slots?maxPrice=25');
    expect(res.status).toBe(200);
    expect(res.body.slots.every(s => s.pricePerHour <= 25)).toBe(true);
  });

  test('paginates results', async () => {
    const res = await request(app).get('/api/parking/slots?limit=1&page=1');
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBe(1);
  });
});

// ─── Get Slot by ID ───────────────────────────────────────────────────────────
describe('GET /api/parking/slots/:id', () => {
  test('returns slot by id', async () => {
    const { body: created } = await request(app).post('/api/parking/slots').send(SLOT);
    const res = await request(app).get(`/api/parking/slots/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(created._id);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/parking/slots/64abcdef1234567890abcdef');
    expect(res.status).toBe(404);
  });
});

// ─── Update Slot ──────────────────────────────────────────────────────────────
describe('PUT /api/parking/slots/:id', () => {
  test('toggles isOperational to false', async () => {
    const { body: created } = await request(app).post('/api/parking/slots').send(SLOT);
    const res = await request(app).put(`/api/parking/slots/${created._id}`)
      .send({ isOperational: false });
    expect(res.status).toBe(200);
    expect(res.body.isOperational).toBe(false);
  });

  test('updates pricePerHour', async () => {
    const { body: created } = await request(app).post('/api/parking/slots').send(SLOT);
    const res = await request(app).put(`/api/parking/slots/${created._id}`)
      .send({ pricePerHour: 50 });
    expect(res.status).toBe(200);
    expect(res.body.pricePerHour).toBe(50);
  });
});

// ─── Delete Slot ──────────────────────────────────────────────────────────────
describe('DELETE /api/parking/slots/:id', () => {
  test('deletes a slot', async () => {
    const { body: created } = await request(app).post('/api/parking/slots').send(SLOT);
    const res = await request(app).delete(`/api/parking/slots/${created._id}`);
    expect(res.status).toBe(200);
    const check = await request(app).get(`/api/parking/slots/${created._id}`);
    expect(check.status).toBe(404);
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────
describe('GET /api/parking/slots/stats', () => {
  test('returns aggregated stats', async () => {
    await request(app).post('/api/parking/slots').send(SLOT);
    const res = await request(app).get('/api/parking/slots/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalSlots');
    expect(res.body).toHaveProperty('availableSlots');
    expect(res.body).toHaveProperty('totalLocations');
    expect(res.body.totalLocations).toBe(1);
  });
});
