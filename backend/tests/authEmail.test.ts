import request from 'supertest';
import { AuthToken } from '../src/models/authToken';
import { User } from '../src/models/user';
import { fakeMailer, testApp, useTestDb } from './helpers';

useTestDb();
beforeAll(() => Promise.all([User.init(), AuthToken.init()]));

function setup() {
  const mailer = fakeMailer();
  return { app: testApp({ mailer }), mailer };
}

const register = (app: ReturnType<typeof testApp>, email = 'Bob@Example.com', password = 'correct-horse') =>
  request(app).post('/api/auth/register').send({ email, password });

describe('register → verify → login', () => {
  it('sends a verification link, verifies, then logs in (email is case-insensitive)', async () => {
    const { app, mailer } = setup();
    expect((await register(app)).status).toBe(201);
    expect(mailer.sent).toEqual([{ kind: 'verify', to: 'bob@example.com', link: expect.stringContaining('/verify-email?token=') }]);

    const verified = await request(app).post('/api/auth/verify-email').send({ token: mailer.lastToken() });
    expect(verified.status).toBe(200);
    expect(verified.body.me.user).toMatchObject({ email: 'bob@example.com', emailVerified: true, hasPassword: true, hasGoogle: false });

    const login = await request(app).post('/api/auth/login').send({ email: 'BOB@example.com', password: 'correct-horse' });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe('string');
  });

  it('blocks login until the email is verified, and resends the link on request', async () => {
    const { app, mailer } = setup();
    await register(app);
    const login = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'correct-horse' });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('EMAIL_NOT_VERIFIED');

    expect((await request(app).post('/api/auth/resend-verification').send({ email: 'bob@example.com' })).status).toBe(204);
    expect(mailer.sent).toHaveLength(2);
  });

  it('uses the same 401 for a wrong password and an unknown email', async () => {
    const { app, mailer } = setup();
    await register(app);
    await request(app).post('/api/auth/verify-email').send({ token: mailer.lastToken() });
    const wrong = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'wrong-password' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it.each([
    [{ email: 'not-an-email', password: 'long-enough' }],
    [{ email: 'a@b.co', password: 'short' }],
    [{ email: 'a@b.co', password: 'x'.repeat(73) }],
  ])('rejects invalid registration %j with 400', async (body) => {
    const { app } = setup();
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(400);
  });

  it('refuses to register an email that already exists, including a Google account', async () => {
    const { app } = setup();
    await request(app).post('/api/auth/google').send({ credential: 'good:carol' }); // carol@example.com
    const res = await register(app, 'carol@example.com');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
    expect((await User.findOne({ email: 'carol@example.com' }))!.passwordHash).toBeUndefined();
  });

  it('rejects a verification token that was already used or is unknown', async () => {
    const { app, mailer } = setup();
    await register(app);
    const token = mailer.lastToken();
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200);
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-email').send({ token: 'made-up' })).status).toBe(400);
  });
});

describe('forgot / reset password', () => {
  it('resets the password with the emailed link, and the old password stops working', async () => {
    const { app, mailer } = setup();
    await register(app);
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'bob@example.com' })).status).toBe(204);
    expect(mailer.sent[mailer.sent.length - 1]).toMatchObject({ kind: 'reset', to: 'bob@example.com' });

    const reset = await request(app).post('/api/auth/reset-password').send({ token: mailer.lastToken(), password: 'new-password-1' });
    expect(reset.status).toBe(204);
    // Reset also verifies the email (the link proved ownership).
    expect((await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'new-password-1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'correct-horse' })).status).toBe(401);
  });

  it('answers 204 for an unknown email without sending anything', async () => {
    const { app, mailer } = setup();
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' })).status).toBe(204);
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects an expired or reused reset token', async () => {
    const { app, mailer } = setup();
    await register(app);
    await request(app).post('/api/auth/forgot-password').send({ email: 'bob@example.com' });
    const token = mailer.lastToken();
    await AuthToken.updateMany({ purpose: 'reset-password' }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'new-password-1' })).status).toBe(400);

    await request(app).post('/api/auth/forgot-password').send({ email: 'bob@example.com' });
    const fresh = mailer.lastToken();
    expect((await request(app).post('/api/auth/reset-password').send({ token: fresh, password: 'new-password-1' })).status).toBe(204);
    expect((await request(app).post('/api/auth/reset-password').send({ token: fresh, password: 'new-password-2' })).status).toBe(400);
  });

  it('lets a Google-only account add a password through the reset email', async () => {
    const { app, mailer } = setup();
    await request(app).post('/api/auth/google').send({ credential: 'good:dana' });
    await request(app).post('/api/auth/forgot-password').send({ email: 'dana@example.com' });
    await request(app).post('/api/auth/reset-password').send({ token: mailer.lastToken(), password: 'dana-password' });
    expect((await request(app).post('/api/auth/login').send({ email: 'dana@example.com', password: 'dana-password' })).status).toBe(200);
  });
});

describe('Google account linking', () => {
  it('links Google to an existing password account when Google verified the email', async () => {
    const { app } = setup();
    await register(app, 'erin@example.com');
    const res = await request(app).post('/api/auth/google').send({ credential: 'good:erin' });
    expect(res.status).toBe(200);
    expect(res.body.me.user).toMatchObject({ hasGoogle: true, hasPassword: true, emailVerified: true });
    expect(await User.countDocuments()).toBe(1);
  });

  it('refuses to link when Google did not verify the email', async () => {
    const { app } = setup();
    await register(app, 'unverified-frank@example.com');
    const res = await request(app).post('/api/auth/google').send({ credential: 'good:unverified-frank' });
    expect(res.status).toBe(409);
    expect((await User.findOne({ email: 'unverified-frank@example.com' }))!.googleId).toBeUndefined();
  });
});

describe('PATCH /api/me/password', () => {
  async function loggedInWithPassword(app: ReturnType<typeof testApp>, mailer: ReturnType<typeof fakeMailer>) {
    await register(app);
    const verified = await request(app).post('/api/auth/verify-email').send({ token: mailer.lastToken() });
    return { Authorization: `Bearer ${verified.body.token}` };
  }

  it('changes the password only with the correct current password', async () => {
    const { app, mailer } = setup();
    const auth = await loggedInWithPassword(app, mailer);
    const wrong = await request(app).patch('/api/me/password').set(auth).send({ currentPassword: 'nope', newPassword: 'brand-new-1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('WRONG_PASSWORD');
    const ok = await request(app).patch('/api/me/password').set(auth).send({ currentPassword: 'correct-horse', newPassword: 'brand-new-1' });
    expect(ok.status).toBe(204);
    expect((await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'brand-new-1' })).status).toBe(200);
  });

  it('lets a Google-only user set a first password without a current one', async () => {
    const { app } = setup();
    const google = await request(app).post('/api/auth/google').send({ credential: 'good:gina' });
    const auth = { Authorization: `Bearer ${google.body.token}` };
    expect((await request(app).patch('/api/me/password').set(auth).send({ newPassword: 'gina-password' })).status).toBe(204);
    expect((await request(app).get('/api/me').set(auth)).body.user.hasPassword).toBe(true);
  });
});
