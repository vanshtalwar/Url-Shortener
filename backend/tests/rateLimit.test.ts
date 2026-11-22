import request from 'supertest';
import express from 'express';
import { config } from '../src/config';
import { createLimiters } from '../src/middleware/rateLimit';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const two = { limit: 2, windowMs: 60_000 };

describe('rate limiting', () => {
  it('limits login attempts per IP', async () => {
    const app = testApp({ rateLimits: { ...config.rateLimits, login: two } });
    const login = (ip: string) =>
      request(app).post('/api/auth/google').set('X-Forwarded-For', ip).send({ credential: 'good:alice' });
    expect((await login('203.0.113.1')).status).toBe(200);
    expect((await login('203.0.113.1')).status).toBe(200);
    const blocked = await login('203.0.113.1');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many/i);
    expect((await login('203.0.113.2')).status).toBe(200); // other IP unaffected
  });

  it('limits link writes per user, not per IP', async () => {
    const app = testApp({ rateLimits: { ...config.rateLimits, linkWrites: two } });
    const alice = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
    const bob = { Authorization: `Bearer ${await loginAs(app, 'bob')}` };
    const create = (auth: Record<string, string>) => request(app).post('/api/links').set(auth).send({ url: 'https://example.com' });

    const first = await create(alice);
    await request(app).patch(`/api/links/${first.body.id}`).set(alice).send({ url: 'https://b.com' });
    expect((await create(alice)).status).toBe(429);
    expect((await request(app).delete(`/api/links/${first.body.id}`).set(alice)).status).toBe(429);
    expect((await request(app).get('/api/links').set(alice)).status).toBe(200); // reads are not limited
    expect((await create(bob)).status).toBe(201);
  });

  it('limits redirects per IP', async () => {
    const app = testApp({ rateLimits: { ...config.rateLimits, redirects: two } });
    const alice = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
    await request(app).post('/api/links').set(alice).send({ url: 'https://example.com', alias: 'hot' });
    const visit = (ip: string) => request(app).get('/hot').set('X-Forwarded-For', ip);
    expect((await visit('203.0.113.1')).status).toBe(302);
    expect((await visit('203.0.113.1')).status).toBe(302);
    expect((await visit('203.0.113.1')).status).toBe(429);
    expect((await visit('203.0.113.2')).status).toBe(302);
  });

  it('fails loudly when the per-user limiter runs without a logged-in user', async () => {
    const app = express();
    app.post('/x', createLimiters(config.rateLimits).linkWrites, (_req, res) => void res.send('ok'));
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
    const res = await request(app).post('/x');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/after requireAuth/);
  });
});
