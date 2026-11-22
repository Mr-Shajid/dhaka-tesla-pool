const request = require('supertest');
const app = require('../src/app');
const { requireRole } = require('../src/middleware/auth');
const { connectTestDB, clearDB, closeDB } = require('./helpers/db');

const nusrat = {
  name: 'Nusrat',
  email: 'nusrat@example.com',
  password: 'Passw0rd!23',
  role: 'PASSENGER',
};
const jashim = {
  name: 'Jashim',
  email: 'jashim@example.com',
  password: 'Passw0rd!23',
  role: 'DRIVER',
};

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(closeDB);

describe('POST /api/auth/register', () => {
  it('registers Nusrat as a passenger and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(nusrat);

    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('nusrat@example.com');
    expect(res.body.user.role).toBe('PASSENGER');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(nusrat);
    const res = await request(app).post('/api/auth/register').send(nusrat);

    expect(res.statusCode).toBe(409);
  });

  it('rejects an invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nusrat, role: 'ADMIN' });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nusrat, password: '123' });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(jashim);
  });

  it('logs Jashim in with the right password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: jashim.email, password: jashim.password });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('DRIVER');
  });

  it('rejects the wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: jashim.email, password: 'WrongPassword1' });

    expect(res.statusCode).toBe(401);
  });

  it('gives the same error for an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Passw0rd!23' });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.statusCode).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const registered = await request(app).post('/api/auth/register').send(nusrat);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe('nusrat@example.com');
  });
});

describe('requireRole', () => {
  function mockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  it('blocks a passenger from a driver-only route', () => {
    const req = { user: { role: 'PASSENGER' } };
    const res = mockResponse();
    const next = jest.fn();

    requireRole('DRIVER')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets a driver through a driver-only route', () => {
    const req = { user: { role: 'DRIVER' } };
    const res = mockResponse();
    const next = jest.fn();

    requireRole('DRIVER')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});