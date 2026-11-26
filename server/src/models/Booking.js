const mongoose = require('mongoose');
const {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
  PAYMENT_METHODS,
  MAX_SEATS_PER_BOOKING,
} = require('../constants/statuses');

const wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const bookingSchema = new mongoose.Schema(
  {
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    poolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pool', default: null },
    pickupZone: { type: String, required: true },
    destinationZone: { type: String, required: true },
    seats: { type: Number, required: true, min: 1, max: MAX_SEATS_PER_BOOKING, validate: wholeNumber },
    distanceKm: { type: Number, required: true, min: 1, validate: wholeNumber },
    baseFarePaisa: { type: Number, required: true, min: 0, validate: wholeNumber },
    distanceChargePaisa: { type: Number, required: true, min: 0, validate: wholeNumber },
    poolDiscountPaisa: { type: Number, default: 0, min: 0, validate: wholeNumber },
    totalFarePaisa: { type: Number, required: true, min: 0, validate: wholeNumber },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'CASH' },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.REQUESTED,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ passengerId: 1, createdAt: -1 });
bookingSchema.index({ poolId: 1 });
bookingSchema.index({ status: 1, pickupZone: 1 });

// Database-level guarantee: one active booking per passenger, even if two requests arrive together.
bookingSchema.index(
  { passengerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_BOOKING_STATUSES } } }
);

module.exports = mongoose.model('Booking', bookingSchema);