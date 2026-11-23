const BASE_FARE_PAISA = 6000; // 60 taka
const PER_KM_PAISA = 2000; // 20 taka per km
const POOL_DISCOUNT_PERCENT = 25;

// All money is whole paisa (integers), so totals always add up exactly.
function calculateFare({ distanceKm, seats = 1, pooled = false }) {
  if (!Number.isInteger(distanceKm) || distanceKm <= 0) {
    throw new Error('distanceKm must be a positive whole number');
  }
  if (!Number.isInteger(seats) || seats < 1) {
    throw new Error('seats must be a positive whole number');
  }

  const baseFarePaisa = BASE_FARE_PAISA * seats;
  const distanceChargePaisa = PER_KM_PAISA * distanceKm * seats;
  const subtotalPaisa = baseFarePaisa + distanceChargePaisa;
  const poolDiscountPaisa = pooled
    ? Math.floor((subtotalPaisa * POOL_DISCOUNT_PERCENT) / 100)
    : 0;

  return {
    baseFarePaisa,
    distanceChargePaisa,
    poolDiscountPaisa,
    totalFarePaisa: subtotalPaisa - poolDiscountPaisa,
  };
}

module.exports = { calculateFare, BASE_FARE_PAISA, PER_KM_PAISA, POOL_DISCOUNT_PERCENT };