const mongoose = require('mongoose');

async function connectTestDB() {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI is not set');

  await mongoose.connect(uri);

  // Safety: never run tests (which wipe data) against the real database.
  if (!mongoose.connection.name.endsWith('-test')) {
    await mongoose.disconnect();
    throw new Error('Refusing to run tests on a database whose name does not end with -test');
  }
}

async function clearDB() {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

async function closeDB() {
  await mongoose.disconnect();
}

module.exports = { connectTestDB, clearDB, closeDB };