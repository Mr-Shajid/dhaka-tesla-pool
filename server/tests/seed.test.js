const User = require('../src/models/User');
const Tesla = require('../src/models/Tesla');
const { seedCast } = require('../src/seed/seedData');
const { connectTestDB, clearDB, closeDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(closeDB);

describe('seedCast', () => {
  it('creates Jashim, Nusrat, Rafiq and Shirin', async () => {
    await seedCast();
    const names = (await User.find()).map((user) => user.name).sort();
    expect(names).toEqual(['Jashim', 'Nusrat', 'Rafiq', 'Shirin']);
  });

  it('gives Jashim a Tesla called Bullet with 3 seats', async () => {
    const { users } = await seedCast();
    const jashim = users.find((user) => user.name === 'Jashim');
    const bullet = await Tesla.findOne({ driverId: jashim._id });

    expect(jashim.role).toBe('DRIVER');
    expect(bullet.name).toBe('Bullet');
    expect(bullet.capacity).toBe(3);
  });

  it('can run twice without creating duplicates', async () => {
    await seedCast();
    await seedCast();
    expect(await User.countDocuments()).toBe(4);
    expect(await Tesla.countDocuments()).toBe(1);
  });

  it('uses story names, never placeholders like user1 or driver1', async () => {
    await seedCast();
    const users = await User.find();
    for (const user of users) {
      expect(user.name).not.toMatch(/^(user|driver|passenger)\d*$/i);
    }
  });
});