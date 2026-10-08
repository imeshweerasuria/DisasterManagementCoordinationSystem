const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');

jest.setTimeout(30000);

beforeAll(async () => {
  await mongoose.connect(
    'mongodb://127.0.0.1:27017/disaster_management_test',
    {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    }
  );
});

afterEach(async () => {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Disaster Event support API', () => {
  test('creates and lists an active event', async () => {
    const create = await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Colombo Flood Event',
        district: 'Colombo',
        hazardType: 'FLOODING',
        startDate: '2026-10-01T00:00:00Z',
      });

    expect(create.status).toBe(201);
    expect(create.body.data.eventCode).toBe(
      'FLOOD-COLOMBO-2026-001'
    );

    const list = await request(app)
      .get('/api/disaster-events')
      .query({ status: 'ACTIVE' });

    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
  });

  test('generates the next event code for the same hazard and district', async () => {
    const first = await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Gampaha Flood',
        district: 'Gampaha',
        hazardType: 'FLOODING',
        startDate: '2026-10-07T00:00:00Z',
      });

    const second = await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Gampaha Flood',
        district: 'Gampaha',
        hazardType: 'FLOODING',
        startDate: '2026-11-01T00:00:00Z',
      });

    expect(first.body.data.eventCode).toBe(
      'FLOOD-GAMPAHA-2026-001'
    );
    expect(second.body.data.eventCode).toBe(
      'FLOOD-GAMPAHA-2026-002'
    );
  });

  test('completes an event with end date', async () => {
    const create = await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Gampaha Flood Event',
        district: 'Gampaha',
        hazardType: 'FLOODING',
        startDate: '2026-10-01T00:00:00Z',
      });

    const complete = await request(app)
      .patch(
        `/api/disaster-events/${create.body.data._id}/complete`
      )
      .send({
        endDate: '2026-10-03T00:00:00Z',
      });

    expect(complete.status).toBe(200);
    expect(complete.body.data.status).toBe('COMPLETED');
  });

  test('rejects event end date before start date', async () => {
    const create = await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Test Event',
        district: 'Colombo',
        hazardType: 'FLOODING',
        startDate: '2026-10-05T00:00:00Z',
      });

    const complete = await request(app)
      .patch(
        `/api/disaster-events/${create.body.data._id}/complete`
      )
      .send({
        endDate: '2026-10-01T00:00:00Z',
      });

    expect(complete.status).toBe(400);
  });

  test('keeps one district on the event', async () => {
    const create = await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Western Flood',
        district: 'Colombo',
        hazardType: 'FLOODING',
        startDate: '2026-10-08T00:00:00Z',
      });

    expect(create.status).toBe(201);
    expect(create.body.data.district).toBe('Colombo');
    expect(create.body.data.eventCode).toBe(
      'FLOOD-COLOMBO-2026-001'
    );
  });

  test('rejects an event with no district', async () => {
    const response = await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Missing District Event',
        hazardType: 'FLOODING',
        startDate: '2026-10-08T00:00:00Z',
      });

    expect(response.status).toBe(400);
  });

  test('returns 404 when completing a missing event', async () => {
    const response = await request(app)
      .patch('/api/disaster-events/64b4c2f2c2a1a1a1a1a1a1a1/complete')
      .send({
        endDate: '2026-10-10T00:00:00Z',
      });

    expect(response.status).toBe(404);
  });

  test('lists events without a status filter', async () => {
    await request(app)
      .post('/api/disaster-events')
      .send({
        name: 'Colombo Flood Event',
        district: 'Colombo',
        hazardType: 'FLOODING',
        startDate: '2026-10-01T00:00:00Z',
      });

    const list = await request(app).get('/api/disaster-events');

    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
  });
});
