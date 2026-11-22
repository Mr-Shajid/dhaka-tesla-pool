const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['PASSENGER', 'DRIVER'], required: true },
    walletPaisa: { type: Number, default: 100000, min: 0 },
}, { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);