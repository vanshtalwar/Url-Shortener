import { loadConfig } from '../src/config';

const base = {
  FRONTEND_ORIGIN: 'https://app.example',
  MONGODB_URI: 'mongodb://db',
  JWT_SECRET: 'j',
  GOOGLE_CLIENT_ID: 'g',
  VISITOR_HASH_SALT: 's',
};

describe('loadConfig', () => {
  it('applies defaults for optional settings', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({ port: 3000, trustProxyHops: 1, frontendOrigin: 'https://app.example' });
    expect(config.rateLimits.redirects).toEqual({ limit: 120, windowMs: 60_000 });
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig({ ...base, TRUST_PROXY_HOPS: '0', REDIRECT_RATE_LIMIT: '500', PORT: '8080' });
    expect(config).toMatchObject({ port: 8080, trustProxyHops: 0 });
    expect(config.rateLimits.redirects.limit).toBe(500);
  });

  it.each(['FRONTEND_ORIGIN', 'MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'VISITOR_HASH_SALT'])(
    'fails at startup when %s is missing',
    (name) => {
      expect(() => loadConfig({ ...base, [name]: undefined })).toThrow(name);
    },
  );

  it.each([['TRUST_PROXY_HOPS', '-1'], ['REDIRECT_RATE_LIMIT', '0'], ['PORT', 'abc']])(
    'rejects invalid %s=%s',
    (name, value) => {
      expect(() => loadConfig({ ...base, [name]: value })).toThrow(name);
    },
  );

  it('is read-only', () => {
    const config = loadConfig(base);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.rateLimits)).toBe(true);
  });
});
