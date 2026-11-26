const request = require('supertest');
const app = require('../../src/app');

async function registerUser(person) {
  const res = await request(app).post('/api/auth/register').send(person);
  return { token: res.body.token, user: res.body.user };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { registerUser, authHeader };