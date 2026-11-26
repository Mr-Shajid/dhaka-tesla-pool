const request = require('supertest');
const app = require('../src/app');
const Booking = require('../src/models/Booking');
const RideEvent = require('../src/models/RideEvent');
const { connectTestDB, clearDB, closeDB } = require('./helpers/db');
const { registerUser, authHeader } = require('./helpers/auth');
const { nusrat, rafiq, jashim } = require('./helpers/cast');

beforeAll(async () => {
  await connectTestDB();
  await Booking.init(); // make sure the unique indexes exist before testing them
});
afterEach(clearDB);
afterAll(closeDB);

const nusratTrip = { pickupZone: 'Banani', destinationZone: 'Mohakhali', seats: 1 };

function requestRide(token, trip = nusratTrip) {
  return request(app).post('/api/bookings').set(authHeader(token)).send(trip);
}

describe('POST /api/bookings/estimate', () => {
  it('shows Nusrat the solo fare and the pooled fare for Banani to Mohakhali', async () => {
    const { token } = await registerUser(nusrat);
    const res = await request(app)
      .post('/api/bookings/estimate')
      .set(authHeader(token))
      .send(nusratTrip);

    expect(res.statusCode).toBe(200);
    expect(res.body.distanceKm).toBe(3);
    expect(res.body.solo.totalFarePaisa).toBe(12000);
    expect(res.body.pooled.totalFarePaisa).toBe(9000);
  });
});

describe('POST /api/bookings', () => {
  it('creates a REQUESTED booking at the solo fare', async () => {
    const { token } = await registerUser(nusrat);
    const res = await requestRide(token);

    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe('REQUESTED');
    expect(res.body.booking.distanceKm).toBe(3);
    expect(res.body.booking.fare.totalFarePaisa).toBe(12000);
    expect(res.body.booking.fare.poolDiscountPaisa).toBe(0);
    expect(res.body.booking.poolId).toBeNull();
  });

  it('rejects the same pickup and destination', async () => {
    const { token } = await registerUser(nusrat);
    const res = await requestRide(token, { pickupZone: 'Banani', destinationZone: 'Banani' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an unknown zone', async () => {
    const { token } = await registerUser(nusrat);
    const res = await requestRide(token, { pickupZone: 'Atlantis', destinationZone: 'Banani' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects zero seats', async () => {
    const { token } = await registerUser(nusrat);
    const res = await requestRide(token, { ...nusratTrip, seats: 0 });
    expect(res.statusCode).toBe(400);
  });

  it('does not let Jashim (a driver) request a ride', async () => {
    const { token } = await registerUser(jashim);
    const res = await requestRide(token);
    expect(res.statusCode).toBe(403);
  });

  it('requires login', async () => {
    const res = await request(app).post('/api/bookings').send(nusratTrip);
    expect(res.statusCode).toBe(401);
  });

  it('allows only one active request per passenger', async () => {
    const { token } = await registerUser(nusrat);
    await requestRide(token);
    const second = await requestRide(token);
    expect(second.statusCode).toBe(409);
  });

  it('lets exactly one of two simultaneous requests through', async () => {
    const { token } = await registerUser(nusrat);
    const results = await Promise.all([requestRide(token), requestRide(token)]);
    const statuses = results.map((res) => res.statusCode).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await Booking.countDocuments()).toBe(1);
  });

  it('records a ride event for the new request', async () => {
    const { token } = await registerUser(nusrat);
    const res = await requestRide(token);
    const events = await RideEvent.find({ bookingId: res.body.booking.id });

    expect(events).toHaveLength(1);
    expect(events[0].toStatus).toBe('REQUESTED');
  });
});

describe('seeing only your own rides', () => {
  it('shows Nusrat her own bookings and nobody else\'s', async () => {
    const nusratLogin = await registerUser(nusrat);
    const rafiqLogin = await registerUser(rafiq);
    await requestRide(nusratLogin.token);
    await requestRide(rafiqLogin.token, {
      pickupZone: 'Banani',
      destinationZone: 'Gulshan 1',
      seats: 1,
    });

    const res = await request(app).get('/api/bookings').set(authHeader(nusratLogin.token));

    expect(res.statusCode).toBe(200);
    expect(res.body.bookings).toHaveLength(1);
    expect(res.body.bookings[0].destinationZone).toBe('Mohakhali');
  });

  it('does not let Rafiq read or cancel Nusrat\'s booking', async () => {
    const nusratLogin = await registerUser(nusrat);
    const rafiqLogin = await registerUser(rafiq);
    const created = await requestRide(nusratLogin.token);
    const id = created.body.booking.id;

    const read = await request(app).get(`/api/bookings/${id}`).set(authHeader(rafiqLogin.token));
    const cancel = await request(app)
      .post(`/api/bookings/${id}/cancel`)
      .set(authHeader(rafiqLogin.token));

    expect(read.statusCode).toBe(404);
    expect(cancel.statusCode).toBe(404);
    expect((await Booking.findById(id)).status).toBe('REQUESTED');
  });
});

describe('POST /api/bookings/:id/cancel', () => {
  it('lets Nusrat cancel a REQUESTED ride and request again afterwards', async () => {
    const { token } = await registerUser(nusrat);
    const created = await requestRide(token);

    const cancel = await request(app)
      .post(`/api/bookings/${created.body.booking.id}/cancel`)
      .set(authHeader(token));
    expect(cancel.statusCode).toBe(200);
    expect(cancel.body.booking.status).toBe('CANCELLED');

    const again = await requestRide(token);
    expect(again.statusCode).toBe(201);
  });

  it('rejects cancelling a ride that is already cancelled', async () => {
    const { token } = await registerUser(nusrat);
    const created = await requestRide(token);
    const path = `/api/bookings/${created.body.booking.id}/cancel`;

    await request(app).post(path).set(authHeader(token));
    const second = await request(app).post(path).set(authHeader(token));

    expect(second.statusCode).toBe(409);
  });

  it('records the cancellation as a ride event', async () => {
    const { token } = await registerUser(nusrat);
    const created = await requestRide(token);
    await request(app)
      .post(`/api/bookings/${created.body.booking.id}/cancel`)
      .set(authHeader(token));

    const events = await RideEvent.find({ bookingId: created.body.booking.id }).sort({ at: 1 });
    expect(events.map((event) => event.toStatus)).toEqual(['REQUESTED', 'CANCELLED']);
  });
});