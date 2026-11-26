const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  estimateFare,
  createBooking,
  listMyBookings,
  getBooking,
  cancelBooking,
} = require('../controllers/booking.controller');

const router = express.Router();

router.use(authenticate, requireRole('PASSENGER'));

router.post('/estimate', estimateFare);
router.post('/', createBooking);
router.get('/', listMyBookings);
router.get('/:id', getBooking);
router.post('/:id/cancel', cancelBooking);

module.exports = router;