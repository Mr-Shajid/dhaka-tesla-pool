const mongoose = require('mongoose');

const teslaSchema = new mongoose.Schema(
  {
    // One driver owns exactly one Tesla (unique).
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    plateNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
      validate: { validator: Number.isInteger, message: 'capacity must be a whole number' },
    },
    isOnline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tesla', teslaSchema);