const mongoose = require('mongoose');
const { POOL_STATUS, ACTIVE_POOL_STATUSES } = require('../constants/statuses');

const wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const poolSchema = new mongoose.Schema(
  {
    teslaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tesla', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pickupZone: { type: String, required: true },
    corridor: { type: String, required: true },
    // Copied from the Tesla when the pool is created.
    seatCapacity: { type: Number, required: true, min: 1, validate: wholeNumber },
    seatsAvailable: {
      type: Number,
      required: true,
      min: 0,
      validate: [
        wholeNumber,
        {
          validator: function seatsWithinCapacity(value) {
            return value <= this.seatCapacity;
          },
          message: 'seatsAvailable cannot be more than seatCapacity',
        },
      ],
    },
    status: {
      type: String,
      enum: Object.values(POOL_STATUS),
      default: POOL_STATUS.ACCEPTED,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

poolSchema.index({ status: 1, pickupZone: 1, corridor: 1 });

// Database-level guarantee: a Tesla has at most one active pool.
poolSchema.index(
  { teslaId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_POOL_STATUSES } } }
);

module.exports = mongoose.model('Pool', poolSchema);