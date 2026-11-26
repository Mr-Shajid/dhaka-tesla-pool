const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const RideEvent = require('../models/RideEvent');
const httpError = require('../utils/httpError');
const { BOOKING_STATUS, ACTIVE_BOOKING_STATUSES } = require('../constants/statuses');
const { getDistanceKm } = require('../config/zones');
const { calculateFare } = require('../services/fare.service');
const { validateBookingInput } = require('../validators/booking.validators');

function serializeBooking(booking) {
  return {
    id: booking._id,
    passengerId: booking.passengerId,
    poolId: booking.poolId,
    pickupZone: booking.pickupZone,
    destinationZone: booking.destinationZone,
    seats: booking.seats,
    distanceKm: booking.distanceKm,
    fare: {
      baseFarePaisa: booking.baseFarePaisa,
      distanceChargePaisa: booking.distanceChargePaisa,
      poolDiscountPaisa: booking.poolDiscountPaisa,
      totalFarePaisa: booking.totalFarePaisa,
    },
    paymentMethod: booking.paymentMethod,
    status: booking.status,
    createdAt: booking.createdAt,
  };
}

// Only ever returns the logged-in passenger's own booking (or null).
async function findOwnBooking(req) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return null;
  return Booking.findOne({ _id: id, passengerId: req.user._id });
}

async function estimateFare(req, res) {
  const errors = validateBookingInput(req.body);
  if (errors.length > 0) throw httpError(400, 'Validation failed', errors);

  const { pickupZone, destinationZone } = req.body;
  const seats = req.body.seats ?? 1;
  const distanceKm = getDistanceKm(pickupZone, destinationZone);

  res.json({
    pickupZone,
    destinationZone,
    seats,
    distanceKm,
    solo: calculateFare({ distanceKm, seats, pooled: false }),
    pooled: calculateFare({ distanceKm, seats, pooled: true }),
  });
}

async function createBooking(req, res) {
  const errors = validateBookingInput(req.body);
  if (errors.length > 0) throw httpError(400, 'Validation failed', errors);

  const { pickupZone, destinationZone } = req.body;
  const seats = req.body.seats ?? 1;
  const paymentMethod = req.body.paymentMethod ?? 'CASH';

  const activeBooking = await Booking.findOne({
    passengerId: req.user._id,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  });
  if (activeBooking) throw httpError(409, 'You already have an active ride request');

  const distanceKm = getDistanceKm(pickupZone, destinationZone);
  const fare = calculateFare({ distanceKm, seats, pooled: false });

  let booking;
  try {
    booking = await Booking.create({
      passengerId: req.user._id,
      pickupZone,
      destinationZone,
      seats,
      distanceKm,
      ...fare,
      paymentMethod,
      status: BOOKING_STATUS.REQUESTED,
    });
  } catch (error) {
    // Two requests at the same instant: the unique index lets only one through.
    if (error.code === 11000) throw httpError(409, 'You already have an active ride request');
    throw error;
  }

  await RideEvent.create({
    bookingId: booking._id,
    fromStatus: null,
    toStatus: BOOKING_STATUS.REQUESTED,
    actorId: req.user._id,
  });

  res.status(201).json({ booking: serializeBooking(booking) });
}

async function listMyBookings(req, res) {
  const bookings = await Booking.find({ passengerId: req.user._id }).sort({ createdAt: -1 });
  res.json({ bookings: bookings.map(serializeBooking) });
}

async function getBooking(req, res) {
  const booking = await findOwnBooking(req);
  if (!booking) throw httpError(404, 'Booking not found');
  res.json({ booking: serializeBooking(booking) });
}

async function cancelBooking(req, res) {
  const existing = await findOwnBooking(req);
  if (!existing) throw httpError(404, 'Booking not found');

  // Atomic: cancels only if it is still REQUESTED at this exact moment.
  const cancelled = await Booking.findOneAndUpdate(
    { _id: existing._id, passengerId: req.user._id, status: BOOKING_STATUS.REQUESTED },
    { status: BOOKING_STATUS.CANCELLED },
    { new: true }
  );
  if (!cancelled) {
    throw httpError(409, `A ride that is ${existing.status} cannot be cancelled`);
  }

  await RideEvent.create({
    bookingId: cancelled._id,
    fromStatus: BOOKING_STATUS.REQUESTED,
    toStatus: BOOKING_STATUS.CANCELLED,
    actorId: req.user._id,
  });

  res.json({ booking: serializeBooking(cancelled) });
}

module.exports = {
  estimateFare,
  createBooking,
  listMyBookings,
  getBooking,
  cancelBooking,
};