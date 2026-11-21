import express from 'express';
import request from 'supertest';
import { User } from '../src/models/user';
import { requireAuth } from '../src/middleware/auth';
import { testApp, useTestDb } from './helpers';

useTestDb();

describe('POST /api/auth/google', () => {
  it('returns a JWT and user for a valid credential', async () => {
    const res = await request(testApp()).post('/api/auth/google').send({ credential: 'good:alice' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ email: 'alice@example.com', name: 'alice' });
  });

  it('creates the user only once across repeated logins', async () => {
    const app = testApp();
    const first = await request(app).post('/api/auth/google').send({ credential: 'good:alice' });
    const second = await request(app).post('/api/auth/google').send({ credential: 'good:alice' });
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(await User.countDocuments()).toBe(1);
  });

  it('rejects an invalid credential with 401', async () => {
    const res = await request(testApp()).post('/api/auth/google').send({ credential: 'forged' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing credential with 400', async () => {
    const res = await request(testApp()).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });
});

describe('requireAuth', () => {
  const app = express();
  app.get('/protected', requireAuth, (_req, res) => {
    res.json({ userId: res.locals.userId });
  });

  it('returns 401 without a token', async () => {
    expect((await request(app).get('/protected')).status).toBe(401);
  });

  it('returns 401 with a bad token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('passes the user id through with a valid token', async () => {
    const login = await request(testApp()).post('/api/auth/google').send({ credential: 'good:bob' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(login.body.user.id);
  });
});
