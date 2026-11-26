const ZONE_CORRIDORS = {
  Banani: 'NORTH_EAST',
  Mohakhali: 'NORTH_EAST',
  'Gulshan 1': 'NORTH_EAST',
  Bashundhara: 'NORTH_EAST',
  Uttara: 'NORTH_EAST',
  Farmgate: 'CENTRAL_WEST',
  Dhanmondi: 'CENTRAL_WEST',
  Mirpur: 'CENTRAL_WEST',
};

// Assumed approximate road distances in whole km (demo values). Same in both directions.
const DISTANCES_KM = [
  ['Banani', 'Mohakhali', 3],
  ['Banani', 'Gulshan 1', 1],
  ['Banani', 'Bashundhara', 5],
  ['Banani', 'Uttara', 9],
  ['Banani', 'Farmgate', 5],
  ['Banani', 'Dhanmondi', 8],
  ['Banani', 'Mirpur', 9],
  ['Mohakhali', 'Gulshan 1', 3],
  ['Mohakhali', 'Bashundhara', 6],
  ['Mohakhali', 'Uttara', 10],
  ['Mohakhali', 'Farmgate', 3],
  ['Mohakhali', 'Dhanmondi', 6],
  ['Mohakhali', 'Mirpur', 8],
  ['Gulshan 1', 'Bashundhara', 4],
  ['Gulshan 1', 'Uttara', 10],
  ['Gulshan 1', 'Farmgate', 6],
  ['Gulshan 1', 'Dhanmondi', 9],
  ['Gulshan 1', 'Mirpur', 11],
  ['Bashundhara', 'Uttara', 6],
  ['Bashundhara', 'Farmgate', 9],
  ['Bashundhara', 'Dhanmondi', 12],
  ['Bashundhara', 'Mirpur', 13],
  ['Uttara', 'Farmgate', 13],
  ['Uttara', 'Dhanmondi', 16],
  ['Uttara', 'Mirpur', 11],
  ['Farmgate', 'Dhanmondi', 3],
  ['Farmgate', 'Mirpur', 7],
  ['Dhanmondi', 'Mirpur', 8],
];

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

const distanceByPair = new Map(
  DISTANCES_KM.map(([a, b, km]) => [pairKey(a, b), km])
);

function isValidZone(zone) {
  return typeof zone === 'string' && Object.prototype.hasOwnProperty.call(ZONE_CORRIDORS, zone);
}

function getCorridor(zone) {
  return ZONE_CORRIDORS[zone];
}

function getDistanceKm(from, to) {
  const km = distanceByPair.get(pairKey(from, to));
  if (km === undefined) {
    throw new Error(`No distance defined between "${from}" and "${to}"`);
  }
  return km;
}

function listZones() {
  return Object.keys(ZONE_CORRIDORS).map((name) => ({ name, corridor: ZONE_CORRIDORS[name] }));
}

module.exports = { isValidZone, getCorridor, getDistanceKm, listZones };