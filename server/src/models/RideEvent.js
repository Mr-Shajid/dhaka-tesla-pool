const mongoose = require('mongoose');

const rideEventSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  poolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pool', default: null },
  fromStatus: { type: String, default: null },
  toStatus: { type: String, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, default: Date.now },
});

rideEventSchema.index({ bookingId: 1, at: 1 });

module.exports = mongoose.model('RideEvent', rideEventSchema);