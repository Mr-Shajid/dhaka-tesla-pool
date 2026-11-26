const { calculateFare } = require('../src/services/fare.service');

describe('calculateFare', () => {
  it('charges Nusrat 12000 paisa for 3 km when riding alone', () => {
    expect(calculateFare({ distanceKm: 3 })).toEqual({
      baseFarePaisa: 6000,
      distanceChargePaisa: 6000,
      poolDiscountPaisa: 0,
      totalFarePaisa: 12000,
    });
  });

  it('charges Nusrat 9000 paisa for 3 km when pooled', () => {
    expect(calculateFare({ distanceKm: 3, pooled: true })).toEqual({
      baseFarePaisa: 6000,
      distanceChargePaisa: 6000,
      poolDiscountPaisa: 3000,
      totalFarePaisa: 9000,
    });
  });

  it('charges Rafiq 8000 alone and 6000 pooled for 1 km', () => {
    expect(calculateFare({ distanceKm: 1 }).totalFarePaisa).toBe(8000);
    expect(calculateFare({ distanceKm: 1, pooled: true })).toEqual({
      baseFarePaisa: 6000,
      distanceChargePaisa: 2000,
      poolDiscountPaisa: 2000,
      totalFarePaisa: 6000,
    });
  });

  it('multiplies by the number of seats', () => {
    expect(calculateFare({ distanceKm: 3, seats: 2, pooled: true })).toEqual({
      baseFarePaisa: 12000,
      distanceChargePaisa: 12000,
      poolDiscountPaisa: 6000,
      totalFarePaisa: 18000,
    });
  });

  it('always returns whole paisa', () => {
    for (let km = 1; km <= 16; km++) {
      const fare = calculateFare({ distanceKm: km, seats: 3, pooled: true });
      for (const value of Object.values(fare)) {
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('rejects a zero, negative or fractional distance', () => {
    expect(() => calculateFare({ distanceKm: 0 })).toThrow();
    expect(() => calculateFare({ distanceKm: -2 })).toThrow();
    expect(() => calculateFare({ distanceKm: 2.5 })).toThrow();
  });

  it('rejects zero seats', () => {
    expect(() => calculateFare({ distanceKm: 3, seats: 0 })).toThrow();
  });
});