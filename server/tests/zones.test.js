const { listZones, isValidZone, getCorridor, getDistanceKm } = require('../src/config/zones');

describe('zones', () => {
  it('has a distance for every pair of different zones, in both directions', () => {
    const names = listZones().map((zone) => zone.name);
    for (const a of names) {
      for (const b of names) {
        if (a === b) continue;
        expect(getDistanceKm(a, b)).toBeGreaterThan(0);
        expect(getDistanceKm(a, b)).toBe(getDistanceKm(b, a));
      }
    }
  });

  it('uses the agreed distances for the demo trips', () => {
    expect(getDistanceKm('Banani', 'Mohakhali')).toBe(3);
    expect(getDistanceKm('Banani', 'Gulshan 1')).toBe(1);
  });

  it('puts Mohakhali and Gulshan 1 in one corridor and Dhanmondi in another', () => {
    expect(getCorridor('Mohakhali')).toBe(getCorridor('Gulshan 1'));
    expect(getCorridor('Dhanmondi')).not.toBe(getCorridor('Banani'));
  });

  it('recognises valid zones only', () => {
    expect(isValidZone('Banani')).toBe(true);
    expect(isValidZone('Atlantis')).toBe(false);
    expect(isValidZone(undefined)).toBe(false);
  });

  it('refuses a distance from a zone to itself', () => {
    expect(() => getDistanceKm('Banani', 'Banani')).toThrow();
  });
});