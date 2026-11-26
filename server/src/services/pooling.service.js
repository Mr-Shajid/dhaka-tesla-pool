const Pool = require('../models/Pool');
const Booking = require('../models/Booking');
const RideEvent = require('../models/RideEvent');
const httpError = require('../utils/httpError');
const { getCorridor } = require('../config/zones');
const { calculateFare } = require('./fare.service');
const {
  BOOKING_STATUS,
  CANCELLABLE_BOOKING_STATUSES,
  POOL_STATUS,
} = require('../constants/statuses');

const OPEN_POOL_STATUSES = [POOL_STATUS.ACCEPTED, POOL_STATUS.DRIVER_ARRIVED];
const POOLED_BOOKING_STATUSES = [BOOKING_STATUS.MATCHED, BOOKING_STATUS.DRIVER_ARRIVED];

// The matching rule (see docs/ARCHITECTURE.md section 5).
function matchesPool(pool, booking) {
  return (
    pool.status === POOL_STATUS.ACCEPTED &&
    pool.pickupZone === booking.pickupZone &&
    pool.corridor === getCorridor(booking.destinationZone) &&
    pool.seatsAvailable >= booking.seats
  );
}

// ATOMIC: takes the seats only if they are still free at this exact moment.
// If two passengers race for the last seat, MongoDB lets exactly one of them win.
async function claimSeats(poolId, seats) {
  return Pool.findOneAndUpdate(
    { _id: poolId, status: POOL_STATUS.ACCEPTED, seatsAvailable: { $gte: seats } },
    { $inc: { seatsAvailable: -seats } },
    { new: true }
  );
}

// Gives seats back, but never above the Tesla's capacity.
async function releaseSeats(poolId, seats) {
  return Pool.findOneAndUpdate(
    {
      _id: poolId,
      status: { $in: OPEN_POOL_STATUSES },
      $expr: { $lte: [{ $add: ['$seatsAvailable', seats] }, '$seatCapacity'] },
    },
    { $inc: { seatsAvailable: seats } },
    { new: true }
  );
}

// ATOMIC: moves a booking REQUESTED -> MATCHED only if it is still REQUESTED.
async function markBookingMatched(bookingId, poolId, actorId) {
  const matched = await Booking.findOneAndUpdate(
    { _id: bookingId, status: BOOKING_STATUS.REQUESTED },
    { status: BOOKING_STATUS.MATCHED, poolId },
    { new: true }
  );
  if (matched) {
    await RideEvent.create({
      bookingId,
      poolId,
      fromStatus: BOOKING_STATUS.REQUESTED,
      toStatus: BOOKING_STATUS.MATCHED,
      actorId,
    });
  }
  return matched;
}

// Each passenger pays their own fare. Two or more passengers in the pool = 25% discount.
// Fares can change only until the trip STARTS; after that they are frozen.
async function recalculatePoolFares(poolId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const pool = await Pool.findById(poolId);
    if (!pool || !OPEN_POOL_STATUSES.includes(pool.status)) return;

    const members = await Booking.find({ poolId, status: { $in: POOLED_BOOKING_STATUSES } });
    const pooled = members.length >= 2;

    await Promise.all(
      members.map((booking) =>
        Booking.updateOne(
          { _id: booking._id, status: { $in: POOLED_BOOKING_STATUSES } },
          {
            $set: calculateFare({
              distanceKm: booking.distanceKm,
              seats: booking.seats,
              pooled,
            }),
          }
        )
      )
    );

    // If someone joined or left while we were calculating, go round again.
    const countNow = await Booking.countDocuments({ poolId, status: { $in: POOLED_BOOKING_STATUSES } });
    if (countNow === members.length) return;
  }
}

// Seat claim + booking update + fares. Undoes the seat claim if the booking was cancelled meanwhile.
async function joinPool({ pool, booking, actorId }) {
  if (!matchesPool(pool, booking)) return null;

  const claimed = await claimSeats(pool._id, booking.seats);
  if (!claimed) return null;

  const matched = await markBookingMatched(booking._id, pool._id, actorId);
  if (!matched) {
    await releaseSeats(pool._id, booking.seats);
    return null;
  }

  await recalculatePoolFares(pool._id);
  return { pool: claimed, booking: await Booking.findById(booking._id) };
}

// Called when a passenger requests a ride: join the oldest open pool that matches, if any.
async function autoMatchBooking(booking) {
  const candidates = await Pool.find({
    status: POOL_STATUS.ACCEPTED,
    pickupZone: booking.pickupZone,
    corridor: getCorridor(booking.destinationZone),
    seatsAvailable: { $gte: booking.seats },
  })
    .sort({ createdAt: 1 })
    .limit(5);

  for (const pool of candidates) {
    const result = await joinPool({ pool, booking, actorId: booking.passengerId });
    if (result) return result;
  }
  return null;
}

// A driver accepts a REQUESTED booking and a new pool is opened for their Tesla.
async function createPoolForBooking({ tesla, booking, actorId }) {
  if (booking.seats > tesla.capacity) {
    throw httpError(409, 'This booking needs more seats than the Tesla has');
  }

  let pool;
  try {
    pool = await Pool.create({
      teslaId: tesla._id,
      driverId: tesla.driverId,
      pickupZone: booking.pickupZone,
      corridor: getCorridor(booking.destinationZone),
      seatCapacity: tesla.capacity,
      seatsAvailable: tesla.capacity - booking.seats,
      status: POOL_STATUS.ACCEPTED,
    });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'This Tesla already has an active pool');
    throw error;
  }

  const matched = await markBookingMatched(booking._id, pool._id, actorId);
  if (!matched) {
    await Pool.deleteOne({ _id: pool._id });
    throw httpError(409, 'That ride request is no longer available');
  }

  await recalculatePoolFares(pool._id);
  return { pool, booking: await Booking.findById(booking._id) };
}

// If every passenger has left, the pool is cancelled so the Tesla is free again.
// The condition "all seats free" is checked atomically, so a passenger who is joining
// at the same moment (and has already claimed a seat) keeps the pool alive.
async function cancelPoolIfEmpty(poolId) {
  return Pool.findOneAndUpdate(
    {
      _id: poolId,
      status: { $in: OPEN_POOL_STATUSES },
      $expr: { $eq: ['$seatsAvailable', '$seatCapacity'] },
    },
    { status: POOL_STATUS.CANCELLED },
    { new: true }
  );
}

// Passenger cancels before the trip starts. Returns the cancelled booking, or null if it
// could not be cancelled (already started, completed or cancelled).
async function cancelPassengerBooking({ bookingId, passengerId }) {
  const before = await Booking.findOneAndUpdate(
    { _id: bookingId, passengerId, status: { $in: CANCELLABLE_BOOKING_STATUSES } },
    { status: BOOKING_STATUS.CANCELLED },
    { new: false }
  );
  if (!before) return null;

  await RideEvent.create({
    bookingId,
    poolId: before.poolId,
    fromStatus: before.status,
    toStatus: BOOKING_STATUS.CANCELLED,
    actorId: passengerId,
  });

  if (before.poolId) {
    await releaseSeats(before.poolId, before.seats);
    await cancelPoolIfEmpty(before.poolId);
    await recalculatePoolFares(before.poolId);
  }

  return Booking.findById(bookingId);
}

module.exports = {
  matchesPool,
  claimSeats,
  releaseSeats,
  recalculatePoolFares,
  joinPool,
  autoMatchBooking,
  createPoolForBooking,
  cancelPoolIfEmpty,
  cancelPassengerBooking,
};