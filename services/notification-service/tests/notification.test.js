const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const notifRoutes = require('../src/routes/notifications');

let mongod;
const app = express();
app.use(express.json());

// mock socket.io on the app
const mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
app.set('io', mockIo);
app.use('/api/notifications', notifRoutes);

const USER_ID  = new mongoose.Types.ObjectId().toString();
const USER_ID2 = new mongoose.Types.ObjectId().toString();

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
  mockIo.to.mockClear();
  mockIo.emit.mockClear();
});

// ─── helper ───────────────────────────────────────────────────────────────────
const createNotif = (userId = USER_ID, overrides = {}) =>
  request(app).post('/api/notifications').send({
    userId, type: 'booking_confirmed', title: 'Booking Confirmed!',
    message: 'Your slot is reserved. OTP: 472913', priority: 'high',
    ...overrides
  });

// ─── Create Notification ──────────────────────────────────────────────────────
describe('POST /api/notifications', () => {
  test('creates notification and emits via socket', async () => {
    const res = await createNotif();
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Booking Confirmed!');
    expect(res.body.isRead).toBe(false);
    expect(mockIo.to).toHaveBeenCalledWith(`user:${USER_ID}`);
    expect(mockIo.emit).toHaveBeenCalledWith('notification:new', expect.any(Object));
  });

  test('rejects missing required fields', async () => {
    const res = await request(app).post('/api/notifications')
      .send({ userId: USER_ID });
    expect(res.status).toBe(500);
  });
});

// ─── Get Notifications ────────────────────────────────────────────────────────
describe('GET /api/notifications', () => {
  beforeEach(async () => {
    await createNotif(USER_ID);
    // create second notif then explicitly mark it read so unreadCount = 1
    const { body: second } = await createNotif(USER_ID, { title: 'Second Alert' });
    await request(app).put(`/api/notifications/${second._id}/read`);
    await createNotif(USER_ID2);     // different user
  });

  test('returns only notifications for the requesting user', async () => {
    const res = await request(app).get('/api/notifications')
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(2);
    expect(res.body.notifications.every(n => n.userId === USER_ID)).toBe(true);
  });

  test('returns correct unread count', async () => {
    const res = await request(app).get('/api/notifications')
      .set('x-user-id', USER_ID);
    expect(res.body.unreadCount).toBe(1);
  });

  test('returns 400 when userId header missing', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(400);
  });
});

// ─── Mark as Read ─────────────────────────────────────────────────────────────
describe('PUT /api/notifications/:id/read', () => {
  test('marks a single notification as read', async () => {
    const { body: notif } = await createNotif();
    const res = await request(app).put(`/api/notifications/${notif._id}/read`);
    expect(res.status).toBe(200);
    expect(res.body.isRead).toBe(true);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app)
      .put(`/api/notifications/${new mongoose.Types.ObjectId()}/read`);
    expect(res.status).toBe(404);
  });
});

// ─── Mark All Read ────────────────────────────────────────────────────────────
describe('PUT /api/notifications/read-all', () => {
  test('marks all unread notifications for a user as read', async () => {
    await createNotif(USER_ID);
    await createNotif(USER_ID);

    const res = await request(app).put('/api/notifications/read-all')
      .set('x-user-id', USER_ID);
    expect(res.status).toBe(200);

    const check = await request(app).get('/api/notifications')
      .set('x-user-id', USER_ID);
    expect(check.body.unreadCount).toBe(0);
  });
});

// ─── Delete Notification ──────────────────────────────────────────────────────
describe('DELETE /api/notifications/:id', () => {
  test('deletes a notification', async () => {
    const { body: notif } = await createNotif();
    const res = await request(app).delete(`/api/notifications/${notif._id}`);
    expect(res.status).toBe(200);

    const check = await request(app).get('/api/notifications')
      .set('x-user-id', USER_ID);
    expect(check.body.notifications.length).toBe(0);
  });
});
