import request from 'supertest';
import { Folder } from '../src/models/folder';
import { User } from '../src/models/user';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();
beforeAll(() => Folder.init());

type App = ReturnType<typeof testApp>;
type Auth = Record<string, string>;

async function setPlan(email: string, status: 'active' | 'halted' | null) {
  const subscription = status && { id: `sub_${email}`, status, interval: 'monthly', currentPeriodEnd: new Date(Date.now() + 86_400_000) };
  await User.updateOne({ email }, { subscription });
}

async function setup() {
  const app = testApp();
  const alice = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  const bob = { Authorization: `Bearer ${await loginAs(app, 'bob')}` };
  await setPlan('alice@example.com', 'active');
  return { app, alice, bob };
}

const newFolder = (app: App, auth: Auth, name: string) => request(app).post('/api/folders').set(auth).send({ name });
const newLink = (app: App, auth: Auth, body: object) => request(app).post('/api/links').set(auth).send({ url: 'https://example.com', ...body });

describe('folders (Pro)', () => {
  it('creates, lists with link counts, renames and deletes (links are kept)', async () => {
    const { app, alice } = await setup();
    const folder = (await newFolder(app, alice, ' Campaigns ')).body;
    expect(folder).toEqual({ id: expect.any(String), name: 'Campaigns', linkCount: 0 });
    const link = (await newLink(app, alice, { folderId: folder.id })).body;
    expect(link.folderId).toBe(folder.id);

    expect((await request(app).get('/api/folders').set(alice)).body).toEqual([{ id: folder.id, name: 'Campaigns', linkCount: 1 }]);
    const renamed = await request(app).patch(`/api/folders/${folder.id}`).set(alice).send({ name: 'Q3' });
    expect(renamed.body).toMatchObject({ name: 'Q3', linkCount: 1 });

    expect((await request(app).delete(`/api/folders/${folder.id}`).set(alice)).status).toBe(204);
    const links = (await request(app).get('/api/links').set(alice)).body;
    expect(links).toHaveLength(1);
    expect(links[0].folderId).toBeNull();
  });

  it('rejects duplicate and invalid names', async () => {
    const { app, alice } = await setup();
    await newFolder(app, alice, 'Same');
    expect((await newFolder(app, alice, 'Same')).status).toBe(409);
    expect((await newFolder(app, alice, '   ')).status).toBe(400);
    expect((await newFolder(app, alice, 'x'.repeat(41))).status).toBe(400);
  });

  it("keeps users' folders separate", async () => {
    const { app, alice, bob } = await setup();
    await setPlan('bob@example.com', 'active');
    const folder = (await newFolder(app, alice, 'Mine')).body;
    expect((await request(app).get('/api/folders').set(bob)).body).toEqual([]);
    expect((await request(app).patch(`/api/folders/${folder.id}`).set(bob).send({ name: 'Stolen' })).status).toBe(404);
    expect((await request(app).delete(`/api/folders/${folder.id}`).set(bob)).status).toBe(404);
    expect((await newLink(app, bob, { folderId: folder.id })).status).toBe(400); // can't file links into someone else's folder
  });

  it('Free users can list and delete folders but not create or rename them', async () => {
    const { app, alice } = await setup();
    const folder = (await newFolder(app, alice, 'Old')).body;
    await setPlan('alice@example.com', 'halted');
    const create = await newFolder(app, alice, 'New');
    expect(create.status).toBe(403);
    expect(create.body.code).toBe('PRO_FEATURE');
    expect((await request(app).patch(`/api/folders/${folder.id}`).set(alice).send({ name: 'Renamed' })).status).toBe(403);
    expect((await request(app).get('/api/folders').set(alice)).body).toHaveLength(1);
    expect((await request(app).delete(`/api/folders/${folder.id}`).set(alice)).status).toBe(204);
  });
});

describe('tags and filters', () => {
  it('normalises tags (lowercase, trimmed, de-duplicated)', async () => {
    const { app, alice } = await setup();
    const link = (await newLink(app, alice, { tags: [' Summer ', 'summer', 'Sale'] })).body;
    expect(link.tags).toEqual(['summer', 'sale']);
  });

  it.each([[['x'.repeat(25)]], [Array.from({ length: 11 }, (_, i) => `t${i}`)], ['not-a-list'], [['bad!tag']]])(
    'rejects invalid tags %j',
    async (tags) => {
      const { app, alice } = await setup();
      expect((await newLink(app, alice, { tags })).status).toBe(400);
    },
  );

  it('filters by folder, tag and search text', async () => {
    const { app, alice } = await setup();
    const folder = (await newFolder(app, alice, 'Ads')).body;
    await newLink(app, alice, { alias: 'spring-sale', folderId: folder.id, tags: ['sale'] });
    await newLink(app, alice, { alias: 'blog-post', url: 'https://blog.example.com/a', tags: ['content'] });
    const codes = async (query: string) => (await request(app).get(`/api/links${query}`).set(alice)).body.map((l: { code: string }) => l.code);

    expect(await codes(`?folder=${folder.id}`)).toEqual(['spring-sale']);
    expect(await codes('?tag=CONTENT')).toEqual(['blog-post']);
    expect(await codes('?q=blog.example')).toEqual(['blog-post']);
    expect(await codes('?q=SPRING')).toEqual(['spring-sale']);
    expect(await codes('?q=.*')).toEqual([]); // search text is literal, not a regex
    expect((await request(app).get('/api/links?folder=nope').set(alice)).status).toBe(400);
  });
});

describe('Pro gating on links', () => {
  it('Free users can create plain links but not set a folder or tags', async () => {
    const { app, alice } = await setup();
    await setPlan('alice@example.com', null);
    expect((await newLink(app, alice, { tags: [] })).status).toBe(201); // empty is fine
    const res = await newLink(app, alice, { tags: ['x'] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PRO_FEATURE');
  });

  it('after a downgrade, tags stay readable and other fields stay editable, but tags are read-only', async () => {
    const { app, alice } = await setup();
    const link = (await newLink(app, alice, { tags: ['vip'] })).body;
    await setPlan('alice@example.com', 'halted');
    expect((await request(app).get('/api/links').set(alice)).body[0].tags).toEqual(['vip']);
    expect((await request(app).patch(`/api/links/${link.id}`).set(alice).send({ url: 'https://new.com' })).status).toBe(200);
    expect((await request(app).patch(`/api/links/${link.id}`).set(alice).send({ tags: [] })).status).toBe(403);
  });
});
