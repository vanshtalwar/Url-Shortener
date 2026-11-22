import request from 'supertest';
import { Click } from '../src/models/click';
import { Link } from '../src/models/link';
import { config } from '../src/config';
import { passwordPage } from '../src/passwordPage';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

async function setup(options: Parameters<typeof testApp>[0] = {}) {
  const app = testApp(options);
  const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  const link = (await request(app).post('/api/links').set(auth).send({ url: 'https://secret.example.com', alias: 'vault', password: 'open sesame' })).body;
  return { app, auth, link };
}

const unlock = (app: ReturnType<typeof testApp>, password: string, code = 'vault') =>
  request(app).post(`/${code}/unlock`).type('form').send({ password });

describe('password-protected links', () => {
  it('exposes hasPassword but never the hash', async () => {
    const { app, auth, link } = await setup();
    expect(link.hasPassword).toBe(true);
    const listed = (await request(app).get('/api/links').set(auth)).body[0];
    expect(listed.hasPassword).toBe(true);
    expect(JSON.stringify(listed)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('shows a password page instead of redirecting, and records no click', async () => {
    const { app } = await setup();
    const res = await request(app).get('/vault');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('action="/vault/unlock"');
    expect(await Click.countDocuments()).toBe(0);
  });

  it('wrong password → 401 page with an error; right password → click recorded + 302', async () => {
    const { app } = await setup();
    const wrong = await unlock(app, 'guess');
    expect(wrong.status).toBe(401);
    expect(wrong.text).toContain('Incorrect password');
    expect(await Click.countDocuments()).toBe(0);

    const right = await unlock(app, 'open sesame');
    expect(right.status).toBe(302);
    expect(right.headers.location).toBe('https://secret.example.com');
    expect(await Click.countDocuments()).toBe(1);
  });

  it('rate-limits password guesses per visitor and link', async () => {
    const { app } = await setup({ rateLimits: { ...config.rateLimits, unlocks: { limit: 2, windowMs: 60_000 } } });
    await unlock(app, 'a');
    await unlock(app, 'b');
    expect((await unlock(app, 'open sesame')).status).toBe(429);
  });

  it('can be removed (null) or changed', async () => {
    const { app, auth, link } = await setup();
    await request(app).patch(`/api/links/${link.id}`).set(auth).send({ password: 'new pass' });
    expect((await unlock(app, 'open sesame')).status).toBe(401);
    expect((await unlock(app, 'new pass')).status).toBe(302);

    const removed = await request(app).patch(`/api/links/${link.id}`).set(auth).send({ password: null });
    expect(removed.body.hasPassword).toBe(false);
    expect((await request(app).get('/vault')).status).toBe(302);
  });

  it('rejects passwords under 4 characters', async () => {
    const { app, auth } = await setup();
    expect((await request(app).post('/api/links').set(auth).send({ url: 'https://a.com', password: 'abc' })).status).toBe(400);
  });

  it('unlock still respects expiry and unknown codes, and ignores unprotected links', async () => {
    const { app, auth } = await setup();
    await Link.updateOne({ code: 'vault' }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await unlock(app, 'open sesame')).status).toBe(410);
    expect((await unlock(app, 'x', 'nope')).status).toBe(404);
    await request(app).post('/api/links').set(auth).send({ url: 'https://open.com', alias: 'open' });
    expect((await unlock(app, 'anything', 'open')).status).toBe(401); // no password set: unlock is meaningless
  });

  it('escapes the code in the page', () => {
    expect(passwordPage('a"b<c', '<script>')).not.toMatch(/<script>|"b</);
  });
});
