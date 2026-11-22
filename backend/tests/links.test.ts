import request from 'supertest';
import mongoose from 'mongoose';
import { Link } from '../src/models/link';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();
beforeAll(() => Link.init()); // build the unique index on code before duplicate tests

const future = () => new Date(Date.now() + 86_400_000).toISOString();

async function setup() {
  const app = testApp();
  const alice = await loginAs(app, 'alice');
  const bob = await loginAs(app, 'bob');
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  return { app, alice: as(alice), bob: as(bob) };
}

describe('POST /api/links', () => {
  it('creates a link with a random 7-character code', async () => {
    const { app, alice } = await setup();
    const res = await request(app).post('/api/links').set(alice).send({ url: 'https://example.com/page' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ url: 'https://example.com/page', clickCount: 0, expiresAt: null });
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  it('uses a custom alias and expiry', async () => {
    const { app, alice } = await setup();
    const expiresAt = future();
    const res = await request(app).post('/api/links').set(alice).send({ url: 'https://example.com', alias: 'my-link_1', expiresAt });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('my-link_1');
    expect(res.body.expiresAt).toBe(expiresAt);
  });

  it.each([
    [{ url: 'not a url' }],
    [{ url: 'ftp://example.com' }],
    [{}],
    [{ url: 'https://example.com', alias: 'ab' }],
    [{ url: 'https://example.com', alias: 'has space' }],
    [{ url: 'https://example.com', expiresAt: '2000-01-01T00:00:00Z' }],
    [{ url: 'https://example.com', expiresAt: 'tomorrow' }],
  ])('rejects invalid input %j with 400', async (body) => {
    const { app, alice } = await setup();
    expect((await request(app).post('/api/links').set(alice).send(body)).status).toBe(400);
  });

  it.each(['api', 'health', 'API', 'Health'])('rejects reserved alias %s with 400', async (alias) => {
    const { app, alice } = await setup();
    const res = await request(app).post('/api/links').set(alice).send({ url: 'https://example.com', alias });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate alias with 409, even across users', async () => {
    const { app, alice, bob } = await setup();
    await request(app).post('/api/links').set(alice).send({ url: 'https://a.com', alias: 'taken' });
    const res = await request(app).post('/api/links').set(bob).send({ url: 'https://b.com', alias: 'taken' });
    expect(res.status).toBe(409);
  });

  it('requires login', async () => {
    const res = await request(testApp()).post('/api/links').send({ url: 'https://example.com' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/links', () => {
  it('lists only my links, newest first', async () => {
    const { app, alice, bob } = await setup();
    await request(app).post('/api/links').set(alice).send({ url: 'https://a.com/1', alias: 'first' });
    await request(app).post('/api/links').set(alice).send({ url: 'https://a.com/2', alias: 'second' });
    await request(app).post('/api/links').set(bob).send({ url: 'https://b.com', alias: 'bobs' });

    const res = await request(app).get('/api/links').set(alice);
    expect(res.status).toBe(200);
    expect(res.body.map((l: { code: string }) => l.code)).toEqual(['second', 'first']);
  });
});

describe('PATCH /api/links/:id', () => {
  it('lets the owner change url, alias and expiry', async () => {
    const { app, alice } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://old.com' });
    const expiresAt = future();
    const res = await request(app)
      .patch(`/api/links/${created.body.id}`)
      .set(alice)
      .send({ url: 'https://new.com', alias: 'renamed', expiresAt });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.body.id, url: 'https://new.com', code: 'renamed', expiresAt });
  });

  it('removes expiry when expiresAt is null', async () => {
    const { app, alice } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://a.com', expiresAt: future() });
    const res = await request(app).patch(`/api/links/${created.body.id}`).set(alice).send({ expiresAt: null });
    expect(res.body.expiresAt).toBeNull();
  });

  it('rejects an alias taken by another link with 409', async () => {
    const { app, alice } = await setup();
    await request(app).post('/api/links').set(alice).send({ url: 'https://a.com', alias: 'taken' });
    const other = await request(app).post('/api/links').set(alice).send({ url: 'https://b.com' });
    const res = await request(app).patch(`/api/links/${other.body.id}`).set(alice).send({ alias: 'taken' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid values with 400', async () => {
    const { app, alice } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://a.com' });
    const res = await request(app).patch(`/api/links/${created.body.id}`).set(alice).send({ url: 'nope' });
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's link, a missing id, or a malformed id", async () => {
    const { app, alice, bob } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://a.com' });
    for (const id of [created.body.id, new mongoose.Types.ObjectId().toString(), 'not-an-id']) {
      const res = await request(app).patch(`/api/links/${id}`).set(bob).send({ url: 'https://evil.com' });
      expect(res.status).toBe(404);
    }
  });
});

describe('DELETE /api/links/:id', () => {
  it('deletes the link and frees its code', async () => {
    const { app, alice } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://a.com', alias: 'gone' });
    expect((await request(app).delete(`/api/links/${created.body.id}`).set(alice)).status).toBe(204);
    expect(await Link.countDocuments()).toBe(0);
    const again = await request(app).post('/api/links').set(alice).send({ url: 'https://b.com', alias: 'gone' });
    expect(again.status).toBe(201);
  });

  it("returns 404 for another user's link", async () => {
    const { app, alice, bob } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://a.com' });
    expect((await request(app).delete(`/api/links/${created.body.id}`).set(bob)).status).toBe(404);
    expect(await Link.countDocuments()).toBe(1);
  });
});

describe('link edge cases', () => {
  it('rejects a URL longer than 2048 characters', async () => {
    const { app, alice } = await setup();
    const url = `https://example.com/${'a'.repeat(2048)}`;
    expect((await request(app).post('/api/links').set(alice).send({ url })).status).toBe(400);
  });

  it('lets you change only the URL of an expired link', async () => {
    const { app, alice } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://a.com', expiresAt: future() });
    await Link.updateOne({ _id: created.body.id }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await request(app).patch(`/api/links/${created.body.id}`).set(alice).send({ url: 'https://b.com' });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://b.com');
  });

  it('treats an empty PATCH as a no-op', async () => {
    const { app, alice } = await setup();
    const created = await request(app).post('/api/links').set(alice).send({ url: 'https://a.com', alias: 'same' });
    const res = await request(app).patch(`/api/links/${created.body.id}`).set(alice).send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);
  });
});

