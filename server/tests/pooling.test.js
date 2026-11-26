const request = require('supertest');
const app = require('../src/app');
const Booking = require('../src/models/Booking');
const Pool = require('../src/models/Pool');
const Tesla = require('../src/models/Tesla');
const User = require('../src/models/User');
const RideEvent = require('../src/models/RideEvent');
const { seedCast } = require('../src/seed/seedData');
const { claimSeats, releaseSeats, createPoolForBooking } = require('../src/services/pooling.service');
const { connectTestDB, clearDB, closeDB } = require('./helpers/db');
const { loginUser, authHeader } = require('./helpers/auth');
const { nusrat, rafiq, shirin } = require('./helpers/cast');

beforeAll(async () => {
  await connectTestDB();
  await Pool.init();
  await Booking.init();
});
afterEach(clearDB);
afterAll(closeDB);

const nusratTrip = { pickupZone: 'Banani', destinationZone: 'Mohakhali', seats: 1 };
const rafiqTrip = { pickupZone: 'Banani', destinationZone: 'Gulshan 1', seats: 1 };

// Jashim, Bullet (3 seats) and the three passengers, all logged in.
async function setupCast() {
  await seedCast();
  const tesla = await Tesla.findOne({ name: 'Bullet' });
  const jashim = await User.findById(tesla.driverId);
  const tokens = {
    nusrat: (await loginUser(nusrat)).token,
    rafiq: (await loginUser(rafiq)).token,
    shirin: (await loginUser(shirin)).token,
  };
  return { tesla, jashim, tokens };
}

function requestRide(token, trip) {
  return request(app).post('/api/bookings').set(authHeader(token)).send(trip);
}

function cancelRide(token, bookingId) {
  return request(app).post(`/api/bookings/${bookingId}/cancel`).set(authHeader(token));
}

// Rafiq asks for a ride and Jashim opens a pool for him (the driver "accept" step).
async function openPoolWithRafiq(ctx, seats = 1) {
  const res = await requestRide(ctx.tokens.rafiq, { ...rafiqTrip, seats });
  const booking = await Booking.findById(res.body.booking.id);
  const { pool } = await createPoolForBooking({
    tesla: ctx.tesla,
    booking,
    actorId: ctx.jashim._id,
  });
  return { pool, rafiqBookingId: booking._id };
}

describe('Pool model rules', () => {
  it('does not allow more free seats than the Tesla has', async () => {
    const ctx = await setupCast();
    const pool = new Pool({
      teslaId: ctx.tesla._id,
      driverId: ctx.jashim._id,
      pickupZone: 'Banani',
      corridor: 'NORTH_EAST',
      seatCapacity: 3,
      seatsAvailable: 4,
    });
    await expect(pool.validate()).rejects.toThrow();
  });

  it('allows Bullet only one active pool at a time', async () => {
    const ctx = await setupCast();
    await openPoolWithRafiq(ctx);

    const res = await requestRide(ctx.tokens.shirin, {
      pickupZone: 'Farmgate',
      destinationZone: 'Dhanmondi',
      seats: 1,
    });
    const shirinBooking = await Booking.findById(res.body.booking.id);

    await expect(
      createPoolForBooking({ tesla: ctx.tesla, booking: shirinBooking, actorId: ctx.jashim._id })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a booking that needs more seats than the Tesla has', async () => {
    const ctx = await setupCast();
    await Tesla.updateOne({ _id: ctx.tesla._id }, { capacity: 2 });
    const smallTesla = await Tesla.findById(ctx.tesla._id);

    const res = await requestRide(ctx.tokens.rafiq, { ...rafiqTrip, seats: 3 });
    const booking = await Booking.findById(res.body.booking.id);

    await expect(
      createPoolForBooking({ tesla: smallTesla, booking, actorId: ctx.jashim._id })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('matching Nusrat into Rafiq\'s pool', () => {
  it('matches Nusrat (Banani to Mohakhali) into the pool and gives both the pooled fare', async () => {
    const ctx = await setupCast();
    const { pool, rafiqBookingId } = await openPoolWithRafiq(ctx);

    const rafiqSolo = await Booking.findById(rafiqBookingId);
    expect(rafiqSolo.totalFarePaisa).toBe(8000);

    const res = await requestRide(ctx.tokens.nusrat, nusratTrip);

    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe('MATCHED');
    expect(res.body.booking.poolId).toBe(String(pool._id));
    expect(res.body.booking.fare.poolDiscountPaisa).toBe(3000);
    expect(res.body.booking.fare.totalFarePaisa).toBe(9000);

    const rafiqPooled = await Booking.findById(rafiqBookingId);
    expect(rafiqPooled.poolDiscountPaisa).toBe(2000);
    expect(rafiqPooled.totalFarePaisa).toBe(6000);

    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(1);
  });

  it('records a MATCHED ride event for Nusrat', async () => {
    const ctx = await setupCast();
    await openPoolWithRafiq(ctx);
    const res = await requestRide(ctx.tokens.nusrat, nusratTrip);

    const events = await RideEvent.find({ bookingId: res.body.booking.id }).sort({ at: 1 });
    expect(events.map((event) => event.toStatus)).toEqual(['REQUESTED', 'MATCHED']);
  });

  it('keeps Shirin waiting when her destination is in a different corridor', async () => {
    const ctx = await setupCast();
    const { pool } = await openPoolWithRafiq(ctx);

    const res = await requestRide(ctx.tokens.shirin, {
      pickupZone: 'Banani',
      destinationZone: 'Dhanmondi',
      seats: 1,
    });

    expect(res.body.booking.status).toBe('REQUESTED');
    expect(res.body.booking.poolId).toBeNull();
    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(2);
  });

  it('keeps Nusrat waiting when her pickup zone is different', async () => {
    const ctx = await setupCast();
    await openPoolWithRafiq(ctx);

    const res = await requestRide(ctx.tokens.nusrat, {
      pickupZone: 'Mohakhali',
      destinationZone: 'Gulshan 1',
      seats: 1,
    });

    expect(res.body.booking.status).toBe('REQUESTED');
  });

  it('keeps Nusrat waiting when the pool has no seats left', async () => {
    const ctx = await setupCast();
    const { pool } = await openPoolWithRafiq(ctx, 3);

    const res = await requestRide(ctx.tokens.nusrat, nusratTrip);

    expect(res.body.booking.status).toBe('REQUESTED');
    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(0);
  });

  it('keeps Nusrat waiting once the driver has arrived', async () => {
    const ctx = await setupCast();
    const { pool } = await openPoolWithRafiq(ctx);
    await Pool.updateOne({ _id: pool._id }, { status: 'DRIVER_ARRIVED' });

    const res = await requestRide(ctx.tokens.nusrat, nusratTrip);

    expect(res.body.booking.status).toBe('REQUESTED');
  });
});

describe('capacity and concurrency', () => {
  it('gives the last seat to exactly one of Nusrat and Shirin when they ask together', async () => {
    const ctx = await setupCast();
    const { pool } = await openPoolWithRafiq(ctx, 2); // Rafiq takes 2 of Bullet's 3 seats

    const results = await Promise.all([
      requestRide(ctx.tokens.nusrat, nusratTrip),
      requestRide(ctx.tokens.shirin, nusratTrip),
    ]);

    expect(results.map((res) => res.statusCode)).toEqual([201, 201]);
    expect(results.map((res) => res.body.booking.status).sort()).toEqual(['MATCHED', 'REQUESTED']);

    const finalPool = await Pool.findById(pool._id);
    expect(finalPool.seatsAvailable).toBe(0);
    expect(await Booking.countDocuments({ poolId: pool._id, status: 'MATCHED' })).toBe(2);
  });

  it('hands out exactly 3 seats when 10 single-seat claims arrive at once', async () => {
    const ctx = await setupCast();
    const pool = await Pool.create({
      teslaId: ctx.tesla._id,
      driverId: ctx.jashim._id,
      pickupZone: 'Banani',
      corridor: 'NORTH_EAST',
      seatCapacity: 3,
      seatsAvailable: 3,
    });

    const claims = await Promise.all(Array.from({ length: 10 }, () => claimSeats(pool._id, 1)));

    expect(claims.filter(Boolean)).toHaveLength(3);
    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(0);
  });

  it('never releases more seats than the Tesla has', async () => {
    const ctx = await setupCast();
    const pool = await Pool.create({
      teslaId: ctx.tesla._id,
      driverId: ctx.jashim._id,
      pickupZone: 'Banani',
      corridor: 'NORTH_EAST',
      seatCapacity: 3,
      seatsAvailable: 3,
    });

    const result = await releaseSeats(pool._id, 1);

    expect(result).toBeNull();
    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(3);
  });
});

describe('cancelling a pooled ride', () => {
  it('frees Nusrat\'s seat and takes Rafiq back to the solo fare', async () => {
    const ctx = await setupCast();
    const { pool, rafiqBookingId } = await openPoolWithRafiq(ctx);
    const nusratRes = await requestRide(ctx.tokens.nusrat, nusratTrip);

    const cancel = await cancelRide(ctx.tokens.nusrat, nusratRes.body.booking.id);

    expect(cancel.statusCode).toBe(200);
    expect(cancel.body.booking.status).toBe('CANCELLED');
    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(2);

    const rafiqNow = await Booking.findById(rafiqBookingId);
    expect(rafiqNow.poolDiscountPaisa).toBe(0);
    expect(rafiqNow.totalFarePaisa).toBe(8000);
  });

  it('lets Shirin take the seat Nusrat gave up', async () => {
    const ctx = await setupCast();
    const { pool } = await openPoolWithRafiq(ctx, 2);
    const nusratRes = await requestRide(ctx.tokens.nusrat, nusratTrip);
    const shirinWaiting = await requestRide(ctx.tokens.shirin, nusratTrip);
    expect(shirinWaiting.body.booking.status).toBe('REQUESTED');

    await cancelRide(ctx.tokens.nusrat, nusratRes.body.booking.id);
    // Shirin cancels her waiting request and asks again; the freed seat is available.
    await cancelRide(ctx.tokens.shirin, shirinWaiting.body.booking.id);
    const again = await requestRide(ctx.tokens.shirin, nusratTrip);

    expect(again.body.booking.status).toBe('MATCHED');
    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(0);
  });

  it('cancels the pool and frees Bullet when the last passenger leaves', async () => {
    const ctx = await setupCast();
    const { pool, rafiqBookingId } = await openPoolWithRafiq(ctx);

    await cancelRide(ctx.tokens.rafiq, String(rafiqBookingId));

    expect((await Pool.findById(pool._id)).status).toBe('CANCELLED');

    const res = await requestRide(ctx.tokens.nusrat, nusratTrip);
    const booking = await Booking.findById(res.body.booking.id);
    const reopened = await createPoolForBooking({
      tesla: ctx.tesla,
      booking,
      actorId: ctx.jashim._id,
    });
    expect(reopened.pool.status).toBe('ACCEPTED');
  });

  it('refuses to cancel once the trip has started and keeps the seats taken', async () => {
    const ctx = await setupCast();
    const { pool } = await openPoolWithRafiq(ctx);
    const nusratRes = await requestRide(ctx.tokens.nusrat, nusratTrip);
    await Booking.updateOne({ _id: nusratRes.body.booking.id }, { status: 'STARTED' });

    const cancel = await cancelRide(ctx.tokens.nusrat, nusratRes.body.booking.id);

    expect(cancel.statusCode).toBe(409);
    expect((await Pool.findById(pool._id)).seatsAvailable).toBe(1);
  });
});