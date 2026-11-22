import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { User } from '../models/user';
import { signToken } from '../middleware/auth';

interface GoogleProfile {
  sub: string;
  email: string;
}

/** Checks a Google ID token; throws if it is invalid. Swapped for a fake in tests. */
export type VerifyGoogleToken = (credential: string) => Promise<GoogleProfile>;

// One shared client: it caches Google's signing certificates between logins.
const googleClient = new OAuth2Client();

export const verifyGoogleToken: VerifyGoogleToken = async (credential) => {
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error('Google token missing sub/email');
  return { sub: payload.sub, email: payload.email };
};

export function authRouter(verify: VerifyGoogleToken) {
  const router = Router();

  router.post('/google', async (req, res) => {
    const credential: unknown = req.body?.credential;
    if (typeof credential !== 'string' || !credential) {
      res.status(400).json({ error: 'credential is required' });
      return;
    }

    let profile: GoogleProfile;
    try {
      profile = await verify(credential);
    } catch {
      res.status(401).json({ error: 'Invalid Google credential' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { googleId: profile.sub },
      { email: profile.email },
      { upsert: true, new: true },
    );

    res.json({
      token: signToken(user.id),
      user: { id: user.id, email: user.email },
    });
  });

  return router;
}
