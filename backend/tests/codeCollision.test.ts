import request from 'supertest';
import { loginAs, testApp, useTestDb } from './helpers';
import { Link } from '../src/models/link';

// Force every random code to be "AAAAAAA" so collisions are guaranteed.
jest.mock('node:crypto', () => ({ ...jest.requireActual('node:crypto'), randomInt: () => 0 }));

useTestDb();
beforeAll(() => Link.init());

describe('random code collisions', () => {
  it('never reports "Alias already taken" when the user gave no alias', async () => {
    const app = testApp();
    const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
    const first = await request(app).post('/api/links').set(auth).send({ url: 'https://a.com' });
    expect(first.body.code).toBe('AAAAAAA');

    const second = await request(app).post('/api/links').set(auth).send({ url: 'https://b.com' });
    expect(second.status).toBe(500); // retried, still colliding (only possible with a rigged generator)
    expect(second.body.error).not.toMatch(/alias/i);
  });
});
