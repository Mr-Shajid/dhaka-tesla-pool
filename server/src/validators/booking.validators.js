const { isValidZone } = require('../config/zones');
const { PAYMENT_METHODS, MAX_SEATS_PER_BOOKING } = require('../constants/statuses');

function validateBookingInput({ pickupZone, destinationZone, seats = 1, paymentMethod = 'CASH' } = {}) {
  const errors = [];
  if (!isValidZone(pickupZone)) errors.push('pickupZone is not a valid zone');
  if (!isValidZone(destinationZone)) errors.push('destinationZone is not a valid zone');
  if (isValidZone(pickupZone) && pickupZone === destinationZone) {
    errors.push('Pickup and destination must be different zones');
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS_PER_BOOKING) {
    errors.push(`seats must be a whole number from 1 to ${MAX_SEATS_PER_BOOKING}`);
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push('paymentMethod must be CASH or TESLAPAY');
  }
  return errors;
}

module.exports = { validateBookingInput };