const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const trafficRoutes = require('../src/routes/traffic');
const TrafficData   = require('../src/models/TrafficData');

let mongod;
const app = express();
app.use(express.json());
app.use('/api/traffic', trafficRoutes);

const ROADS = [
  { roadName: 'Cyber Towers Road',   area: 'HITEC City', congestionLevel: 'heavy',    congestionScore: 78, averageSpeed: 18, vehicleCount: 312, incidentType: 'accident',  location: { type: 'Point', coordinates: [78.3733, 17.4435] } },
  { roadName: 'Madhapur Main Road',  area: 'Madhapur',   congestionLevel: 'moderate', congestionScore: 52, averageSpeed: 28, vehicleCount: 198, incidentType: 'none',      location: { type: 'Point', coordinates: [78.3780, 17.4500] } },
  { roadName: 'Gachibowli Flyover',  area: 'Gachibowli', congestionLevel: 'free',     congestionScore: 21, averageSpeed: 55, vehicleCount:  87, incidentType: 'none',      location: { type: 'Point', coordinates: [78.3500, 17.4400] } },
];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await TrafficData.create(ROADS);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ─── Get All Traffic ──────────────────────────────────────────────────────────
describe('GET /api/traffic', () => {
  test('returns latest reading per road', async () => {
    const res = await request(app).get('/api/traffic');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
  });

  test('filters by area', async () => {
    const res = await request(app).get('/api/traffic?area=Madhapur');
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.area.toLowerCase().includes('madhapur'))).toBe(true);
  });

  test('filters by congestion level', async () => {
    const res = await request(app).get('/api/traffic?congestion=heavy');
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.congestionLevel === 'heavy')).toBe(true);
  });
});

// ─── Traffic Stats ────────────────────────────────────────────────────────────
describe('GET /api/traffic/stats', () => {
  test('returns counts grouped by congestion level', async () => {
    const res = await request(app).get('/api/traffic/stats');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const levels = res.body.map(s => s._id);
    expect(levels).toContain('heavy');
    expect(levels).toContain('free');
  });
});

// ─── Heatmap ─────────────────────────────────────────────────────────────────
describe('GET /api/traffic/heatmap', () => {
  test('returns heatmap points with lat/lng/intensity', async () => {
    const res = await request(app).get('/api/traffic/heatmap');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('lat');
    expect(res.body[0]).toHaveProperty('lng');
    expect(res.body[0]).toHaveProperty('intensity');
  });
});

// ─── ETA ─────────────────────────────────────────────────────────────────────
describe('GET /api/traffic/eta', () => {
  test('returns ETA with distance and congestion score', async () => {
    const res = await request(app)
      .get('/api/traffic/eta?fromLat=17.4435&fromLng=78.3733&toLat=17.3850&toLng=78.4867');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('distance');
    expect(res.body).toHaveProperty('etaMinutes');
    expect(res.body).toHaveProperty('congestionScore');
    expect(res.body).toHaveProperty('trafficLevel');
    expect(res.body.etaMinutes).toBeGreaterThan(0);
  });

  test('returns 400 when coordinates missing', async () => {
    const res = await request(app).get('/api/traffic/eta?fromLat=17.44');
    expect(res.status).toBe(400);
  });
});

// ─── Nearby Traffic ───────────────────────────────────────────────────────────
describe('GET /api/traffic/nearby', () => {
  test('returns nearby roads within radius', async () => {
    const res = await request(app)
      .get('/api/traffic/nearby?lat=17.4435&lng=78.3733&radius=5000');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns 400 when lat/lng missing', async () => {
    const res = await request(app).get('/api/traffic/nearby');
    expect(res.status).toBe(400);
  });
});
