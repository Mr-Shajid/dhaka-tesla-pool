const mongoose = require('mongoose');
const Tesla = require('../src/models/Tesla');
const { connectTestDB, clearDB, closeDB } = require('./helpers/db');

beforeAll(async () => {
  await connectTestDB();
  await Tesla.init(); // make sure the unique indexes exist before testing them
});
afterEach(clearDB);
afterAll(closeDB);

function bulletData(overrides = {}) {
  return {
    driverId: new mongoose.Types.ObjectId(),
    name: 'Bullet',
    plateNo: 'DHAKA METRO-GA-14-3003',
    capacity: 3,
    ...overrides,
  };
}

describe('Tesla model', () => {
  it('accepts Bullet with 3 seats and starts offline', async () => {
    const bullet = await Tesla.create(bulletData());
    expect(bullet.capacity).toBe(3);
    expect(bullet.isOnline).toBe(false);
  });

  it('rejects a capacity of 0', async () => {
    await expect(new Tesla(bulletData({ capacity: 0 })).validate()).rejects.toThrow();
  });

  it('rejects a capacity that is not a whole number', async () => {
    await expect(new Tesla(bulletData({ capacity: 2.5 })).validate()).rejects.toThrow();
  });

  it('does not let one driver own two Teslas', async () => {
    const driverId = new mongoose.Types.ObjectId();
    await Tesla.create(bulletData({ driverId }));
    await expect(
      Tesla.create(bulletData({ driverId, plateNo: 'DHAKA METRO-KHA-11-0001' }))
    ).rejects.toMatchObject({ code: 11000 });
  });
});