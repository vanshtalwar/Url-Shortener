import { Router, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { User, type UserRecord } from '../models/user';
import { signToken } from '../middleware/auth';
import { buildMe } from '../me';
import { consumeToken, issueToken } from '../authTokens';
import type { Mailer } from '../mailer';
import { checkPassword, hashPassword, normalizeEmail, passwordError } from '../passwords';

interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

/** Checks a Google ID token; throws if it is invalid. Swapped for a fake in tests. */
export type VerifyGoogleToken = (credential: string) => Promise<GoogleProfile>;

// One shared client: it caches Google's signing certificates between logins.
const googleClient = new OAuth2Client();

export const verifyGoogleToken: VerifyGoogleToken = async (credential) => {
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error('Google token missing sub/email');
  return { sub: payload.sub, email: payload.email, emailVerified: payload.email_verified === true };
};

async function sendSession(res: Response, user: UserRecord) {
  res.json({ token: signToken(user._id.toString()), me: await buildMe(user) });
}

function fail(res: Response, status: number, error: string, code?: string) {
  res.status(status).json(code ? { error, code } : { error });
}

/** Finds the Google user, links Google to an existing email account (only if Google verified the email), or creates one. */
async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<UserRecord | 'email-taken'> {
  const existing = await User.findOne({ googleId: profile.sub }).lean();
  if (existing) return existing;

  const email = profile.email.toLowerCase();
  const sameEmail = await User.findOne({ email }).lean();
  if (sameEmail) {
    if (!profile.emailVerified) return 'email-taken';
    return (await User.findByIdAndUpdate(sameEmail._id, { googleId: profile.sub, emailVerified: true }, { new: true, lean: true }))!;
  }
  return (await User.create({ email, googleId: profile.sub, emailVerified: true })).toObject();
}

export function authRouter(verify: VerifyGoogleToken, mailer: Mailer) {
  const router = Router();
  const link = (path: string, token: string) => `${config.frontendOrigin}${path}?token=${token}`;

  const sendVerificationEmail = async (user: UserRecord) => {
    const token = await issueToken(user._id, 'verify-email');
    await mailer.sendVerification(user.email, link('/verify-email', token));
  };

  router.post('/google', async (req, res) => {
    const credential: unknown = req.body?.credential;
    if (typeof credential !== 'string' || !credential) return fail(res, 400, 'credential is required');

    let profile: GoogleProfile;
    try {
      profile = await verify(credential);
    } catch {
      return fail(res, 401, 'Invalid Google credential');
    }

    const user = await findOrCreateGoogleUser(profile);
    if (user === 'email-taken') return fail(res, 409, 'An account with this email already exists', 'EMAIL_TAKEN');
    await sendSession(res, user);
  });

  router.post('/register', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return fail(res, 400, 'Enter a valid email address');
    const badPassword = passwordError(req.body?.password);
    if (badPassword) return fail(res, 400, badPassword);

    // Never attach a password to an existing (e.g. Google) account here: that would let anyone claim it.
    // Adding a password to an existing account goes through forgot-password, which proves email ownership.
    if (await User.exists({ email })) {
      return fail(res, 409, 'An account with this email already exists. Log in, or reset your password.', 'EMAIL_TAKEN');
    }
    const user = (await User.create({ email, passwordHash: await hashPassword(req.body.password) })).toObject();
    await sendVerificationEmail(user);
    res.status(201).json({ message: 'Check your email to verify your account' });
  });

  router.post('/verify-email', async (req, res) => {
    const userId = await consumeToken(req.body?.token, 'verify-email');
    const user = userId && (await User.findByIdAndUpdate(userId, { emailVerified: true }, { new: true, lean: true }));
    if (!user) return fail(res, 400, 'This verification link is invalid or has expired', 'INVALID_TOKEN');
    await sendSession(res, user);
  });

  // Always 204, so the response never reveals whether an email is registered.
  router.post('/resend-verification', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const user = email && (await User.findOne({ email }).lean());
    if (user && !user.emailVerified) await sendVerificationEmail(user);
    res.status(204).end();
  });

  router.post('/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password: unknown = req.body?.password;
    const user = email ? await User.findOne({ email }).lean() : null;
    const ok = typeof password === 'string' && (await checkPassword(password, user?.passwordHash));
    if (!user || !ok) return fail(res, 401, 'Incorrect email or password');
    if (!user.emailVerified) return fail(res, 403, 'Verify your email before logging in', 'EMAIL_NOT_VERIFIED');
    await sendSession(res, user);
  });

  // Always 204, so the response never reveals whether an email is registered.
  router.post('/forgot-password', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const user = email && (await User.findOne({ email }).lean());
    if (user) {
      const token = await issueToken(user._id, 'reset-password');
      await mailer.sendPasswordReset(user.email, link('/reset-password', token));
    }
    res.status(204).end();
  });

  router.post('/reset-password', async (req, res) => {
    const badPassword = passwordError(req.body?.password);
    if (badPassword) return fail(res, 400, badPassword);
    const userId = await consumeToken(req.body?.token, 'reset-password');
    if (!userId) return fail(res, 400, 'This reset link is invalid or has expired', 'INVALID_TOKEN');
    // The emailed link proves the user owns the address, so it also counts as verification.
    await User.updateOne({ _id: userId }, { passwordHash: await hashPassword(req.body.password), emailVerified: true });
    res.status(204).end();
  });

  return router;
}
