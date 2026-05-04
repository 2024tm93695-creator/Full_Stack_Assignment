const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authRoutes = require('../src/routes/auth');

let mongod;
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

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

// ─── helpers ──────────────────────────────────────────────────────────────────
const registerUser = (overrides = {}) =>
  request(app).post('/api/auth/register').send({
    name: 'Test User', email: 'test@example.com', password: 'pass1234',
    phone: '9876543210', vehicleNumber: 'TS09AB1234', vehicleType: 'car',
    ...overrides
  });

// ─── Register ─────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  test('registers a new user and returns token', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.role).toBe('user');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('rejects duplicate email', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  test('rejects missing name', async () => {
    const res = await registerUser({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('rejects invalid email', async () => {
    const res = await registerUser({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('rejects password shorter than 6 chars', async () => {
    const res = await registerUser({ password: '123' });
    expect(res.status).toBe(400);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(() => registerUser());

  test('logs in with correct credentials and returns token', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
  });

  test('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  test('rejects non-existent email', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'pass1234' });
    expect(res.status).toBe(401);
  });

  test('rejects missing password field', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });
});

// ─── Profile ──────────────────────────────────────────────────────────────────
describe('GET /api/auth/profile', () => {
  let token;
  beforeEach(async () => {
    const res = await registerUser();
    token = res.body.token;
  });

  test('returns profile for valid token', async () => {
    const res = await request(app).get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
  });

  test('rejects request without token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  test('rejects invalid token', async () => {
    const res = await request(app).get('/api/auth/profile')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});

// ─── Update Profile ───────────────────────────────────────────────────────────
describe('PUT /api/auth/profile', () => {
  let token;
  beforeEach(async () => {
    const res = await registerUser();
    token = res.body.token;
  });

  test('updates name and phone', async () => {
    const res = await request(app).put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', phone: '1111111111' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });
});

// ─── Admin: Get All Users ─────────────────────────────────────────────────────
describe('GET /api/auth/users', () => {
  test('rejects non-admin user', async () => {
    const { body } = await registerUser();
    const res = await request(app).get('/api/auth/users')
      .set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(403);
  });
});
