require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { seedCast, DEMO_PASSWORD } = require('./seedData');

async function run() {
  try {
    await connectDB(process.env.MONGODB_URI);
    const { users, bullet } = await seedCast();
    console.log(`Seeded ${users.length} users and the Tesla "${bullet.name}" (${bullet.capacity} seats).`);
    console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();