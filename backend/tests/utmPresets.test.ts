import request from 'supertest';
import { User } from '../src/models/user';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const preset = { name: 'Newsletter', source: 'newsletter', medium: 'email', campaign: 'spring' };

async function setup(pro = true) {
  const app = testApp();
  const alice = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  if (pro) {
    await User.updateOne({ email: 'alice@example.com' }, { subscription: { id: 's', status: 'active', interval: 'monthly', currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
  }
  return { app, alice };
}

describe('UTM presets', () => {
  it('Pro can save, list and delete presets', async () => {
    const { app, alice } = await setup();
    const created = await request(app).post('/api/utm-presets').set(alice).send({ ...preset, term: ' shoes ' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: expect.any(String), ...preset, term: 'shoes', content: '' });
    expect((await request(app).get('/api/utm-presets').set(alice)).body).toHaveLength(1);
    expect((await request(app).delete(`/api/utm-presets/${created.body.id}`).set(alice)).status).toBe(204);
    expect((await request(app).get('/api/utm-presets').set(alice)).body).toEqual([]);
  });

  it.each([[{ ...preset, source: '' }], [{ ...preset, campaign: 'x'.repeat(101) }], [{ ...preset, medium: 5 }]])(
    'rejects invalid preset %j',
    async (body) => {
      const { app, alice } = await setup();
      expect((await request(app).post('/api/utm-presets').set(alice).send(body)).status).toBe(400);
    },
  );

  it('Free cannot save presets', async () => {
    const { app, alice } = await setup(false);
    const res = await request(app).post('/api/utm-presets').set(alice).send(preset);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PRO_FEATURE');
  });

  it("can't delete another user's preset", async () => {
    const { app, alice } = await setup();
    const id = (await request(app).post('/api/utm-presets').set(alice).send(preset)).body.id;
    const bob = { Authorization: `Bearer ${await loginAs(app, 'bob')}` };
    expect((await request(app).delete(`/api/utm-presets/${id}`).set(bob)).status).toBe(404);
    expect((await request(app).delete('/api/utm-presets/not-an-id').set(bob)).status).toBe(404);
  });
});
