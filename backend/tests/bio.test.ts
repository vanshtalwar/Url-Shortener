import request from 'supertest';
import { Bio } from '../src/models/bio';
import { Link } from '../src/models/link';
import { User } from '../src/models/user';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();
beforeAll(() => Bio.init());

type App = ReturnType<typeof testApp>;

const setPro = (email: string, on: boolean) =>
  User.updateOne(
    { email },
    { subscription: on ? { id: `s_${email}`, status: 'active', interval: 'monthly', currentPeriodEnd: new Date(Date.now() + 86_400_000) } : null },
  );

async function setup() {
  const app = testApp();
  const alice = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  await setPro('alice@example.com', true);
  const one = (await request(app).post('/api/links').set(alice).send({ url: 'https://one.com', alias: 'one-link' })).body;
  const two = (await request(app).post('/api/links').set(alice).send({ url: 'https://two.com', alias: 'two-link' })).body;
  return { app, alice, one, two };
}

const page = (one: { id: string }, two: { id: string }) => ({
  handle: 'Alice_99',
  title: ' Alice ',
  description: 'Links I like',
  theme: 'midnight',
  links: [
    { linkId: one.id, label: 'Portfolio' },
    { linkId: two.id, label: 'Blog' },
  ],
});

const put = (app: App, auth: object, body: object) => request(app).put('/api/bio').set(auth as Record<string, string>).send(body);

describe('link-in-bio', () => {
  it('publishes a page and serves it publicly with tracked short links', async () => {
    const { app, alice, one, two } = await setup();
    const saved = await put(app, alice, page(one, two));
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ handle: 'alice_99', title: 'Alice', theme: 'midnight' });
    expect((await request(app).get('/api/me').set(alice)).body.user.bioHandle).toBe('alice_99');

    const pub = await request(app).get('/api/public/bio/ALICE_99');
    expect(pub.status).toBe(200);
    expect(pub.body).toEqual({
      title: 'Alice',
      description: 'Links I like',
      theme: 'midnight',
      links: [
        { label: 'Portfolio', shortUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/one-link$/) },
        { label: 'Blog', shortUrl: expect.stringMatching(/\/two-link$/) },
      ],
    });
    expect(JSON.stringify(pub.body)).not.toMatch(/linkId|owner|https:\/\/one\.com/); // destinations and ids stay private
  });

  it('drops deleted and expired links from the public page', async () => {
    const { app, alice, one, two } = await setup();
    await put(app, alice, page(one, two));
    await request(app).delete(`/api/links/${one.id}`).set(alice);
    await Link.updateOne({ code: 'two-link' }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).get('/api/public/bio/alice_99')).body.links).toEqual([]);
  });

  it.each([
    [{ handle: 'ab' }],
    [{ handle: 'has space' }],
    [{ handle: 'admin' }],
    [{ title: '' }],
    [{ theme: 'neon' }],
    [{ links: 'nope' }],
  ])('rejects invalid page %j', async (override) => {
    const { app, alice, one, two } = await setup();
    expect((await put(app, alice, { ...page(one, two), ...override })).status).toBe(400);
  });

  it("refuses other users' links and taken handles", async () => {
    const { app, alice, one, two } = await setup();
    await put(app, alice, page(one, two));
    const bob = { Authorization: `Bearer ${await loginAs(app, 'bob')}` };
    await setPro('bob@example.com', true);
    expect((await put(app, bob, { ...page(one, two), handle: 'bobs_page' })).status).toBe(400); // alice's links
    const taken = await put(app, bob, { ...page(one, two), links: [] });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('HANDLE_TAKEN');
  });

  it('is Pro-only to publish/edit; stays online after a downgrade and can still be deleted', async () => {
    const { app, alice, one, two } = await setup();
    await put(app, alice, page(one, two));
    await setPro('alice@example.com', false);

    const edit = await put(app, alice, { ...page(one, two), title: 'New' });
    expect(edit.status).toBe(403);
    expect(edit.body.code).toBe('PRO_FEATURE');
    expect((await request(app).get('/api/public/bio/alice_99')).status).toBe(200);
    expect((await request(app).get('/api/bio').set(alice)).body.title).toBe('Alice');

    expect((await request(app).delete('/api/bio').set(alice)).status).toBe(204);
    expect((await request(app).get('/api/public/bio/alice_99')).status).toBe(404);
    expect((await request(app).get('/api/bio').set(alice)).body).toBeNull();
  });

  it('returns 404 for an unknown handle', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/public/bio/nobody_here')).status).toBe(404);
  });
});
