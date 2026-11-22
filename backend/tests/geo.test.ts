import request from 'supertest';
import { User } from '../src/models/user';
import { Click } from '../src/models/click';
import { createGeoLookup, toLocation } from '../src/geo';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const PLACES: Record<string, { country: string; city: string }> = {
  '1.1.1.1': { country: 'IN', city: 'Mumbai' },
  '2.2.2.2': { country: 'IN', city: 'Delhi' },
  '3.3.3.3': { country: 'US', city: 'Springfield' },
  '4.4.4.4': { country: 'GB', city: 'Unknown' },
};
const fakeGeo = async (ip: string | undefined) => PLACES[ip ?? ''] ?? { country: 'Unknown', city: 'Unknown' };

async function setup(pro: boolean) {
  const app = testApp({ geo: fakeGeo, trustProxyHops: 1 });
  const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  if (pro) {
    await User.updateOne({ email: 'alice@example.com' }, { subscription: { id: 's', status: 'active', interval: 'monthly', currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
  }
  const link = (await request(app).post('/api/links').set(auth).send({ url: 'https://a.com', alias: 'geo-test' })).body;
  for (const ip of ['1.1.1.1', '1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4']) {
    await request(app).get('/geo-test').set('X-Forwarded-For', ip);
  }
  return { app, auth, link };
}

describe('country / city analytics', () => {
  it('stores country and city on each click', async () => {
    await setup(true);
    expect(await Click.findOne().lean()).toMatchObject({ country: 'IN', city: 'Mumbai' });
  });

  it('Pro sees countries and cities (cities labelled with country, unknown kept separate)', async () => {
    const { app, auth, link } = await setup(true);
    const stats = (await request(app).get(`/api/links/${link.id}/stats`).set(auth)).body;
    expect(stats.countries).toEqual([
      { value: 'IN', count: 3 },
      { value: 'GB', count: 1 },
      { value: 'US', count: 1 },
    ]);
    expect(stats.cities).toEqual([
      { value: 'Mumbai, IN', count: 2 },
      { value: 'Delhi, IN', count: 1 },
      { value: 'Springfield, US', count: 1 },
      { value: 'Unknown', count: 1 },
    ]);
  });

  it('Free gets null (data is still collected, shown after upgrading)', async () => {
    const { app, auth, link } = await setup(false);
    const stats = (await request(app).get(`/api/links/${link.id}/stats`).set(auth)).body;
    expect(stats).toMatchObject({ countries: null, cities: null });
    expect(await Click.countDocuments({ country: 'IN' })).toBe(3);
  });
});

describe('createGeoLookup / toLocation', () => {
  it('returns Unknown when the database file is missing (app keeps working)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const lookup = createGeoLookup('/definitely/not/here.mmdb');
    expect(await lookup('8.8.8.8')).toEqual({ country: 'Unknown', city: 'Unknown' });
    expect(await lookup(undefined)).toEqual({ country: 'Unknown', city: 'Unknown' });
    expect(warn).toHaveBeenCalledTimes(1); // warns once, not per click
    warn.mockRestore();
  });

  it('reads country code and English city name, falling back to the registered country', () => {
    expect(toLocation({ country: { iso_code: 'IN' }, city: { names: { en: 'Pune' } } } as never)).toEqual({ country: 'IN', city: 'Pune' });
    expect(toLocation({ registered_country: { iso_code: 'DE' } } as never)).toEqual({ country: 'DE', city: 'Unknown' });
    expect(toLocation(null)).toEqual({ country: 'Unknown', city: 'Unknown' });
  });
});
