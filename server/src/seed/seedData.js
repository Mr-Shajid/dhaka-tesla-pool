const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Tesla = require('../models/Tesla');

const DEMO_PASSWORD = 'Passw0rd!23';

const cast = [
  { name: 'Jashim', email: 'jashim@example.com', role: 'DRIVER' },
  { name: 'Nusrat', email: 'nusrat@example.com', role: 'PASSENGER' },
  { name: 'Rafiq', email: 'rafiq@example.com', role: 'PASSENGER' },
  { name: 'Shirin', email: 'shirin@example.com', role: 'PASSENGER' },
];


async function seedCast() {
  const emails = cast.map((person) => person.email);
  const existing = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existing.map((user) => user._id);

  await Tesla.deleteMany({ driverId: { $in: existingIds } });
  await User.deleteMany({ _id: { $in: existingIds } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = await User.insertMany(cast.map((person) => ({ ...person, passwordHash })));

  const jashim = users.find((user) => user.email === 'jashim@example.com');
  const bullet = await Tesla.create({
    driverId: jashim._id,
    name: 'Bullet',
    plateNo: 'DHAKA METRO-GA-14-3003',
    capacity: 3,
    isOnline: false,
  });

  return { users, bullet };
}

module.exports = { seedCast, DEMO_PASSWORD };