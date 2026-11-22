import { parseLinkInput } from '../src/linkInput';

const NOW = Date.parse('2026-01-01T00:00:00Z');

describe('parseLinkInput', () => {
  it('create: requires url and treats an empty alias as "random code"', () => {
    expect(parseLinkInput({}, 'create', NOW)).toEqual({ error: 'url is required' });
    expect(parseLinkInput({ url: 'https://a.com', alias: '' }, 'create', NOW)).toEqual({ input: { url: 'https://a.com' } });
  });

  it('update: only returns fields that were sent', () => {
    expect(parseLinkInput({ url: 'https://a.com' }, 'update', NOW)).toEqual({ input: { url: 'https://a.com' } });
    expect(parseLinkInput({}, 'update', NOW)).toEqual({ input: {} });
  });

  it('update: an empty alias is an error, not "remove the alias"', () => {
    expect(parseLinkInput({ alias: '' }, 'update', NOW)).toHaveProperty('error');
  });

  it('uses the given clock for expiry checks', () => {
    const tomorrow = '2026-01-02T00:00:00.000Z';
    expect(parseLinkInput({ expiresAt: tomorrow }, 'update', NOW)).toEqual({ input: { expiresAt: new Date(tomorrow) } });
    expect(parseLinkInput({ expiresAt: tomorrow }, 'update', Date.parse('2026-01-03'))).toEqual({
      error: 'expiresAt must be in the future',
    });
  });

  it('null expiresAt means "remove the expiry"', () => {
    expect(parseLinkInput({ expiresAt: null }, 'update', NOW)).toEqual({ input: { expiresAt: null } });
  });
});
