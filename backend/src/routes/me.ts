import { Router } from 'express';
import { User } from '../models/user';
import { accountOf } from '../middleware/account';
import { buildMe } from '../me';
import { checkPassword, hashPassword, passwordError } from '../passwords';

/** Expects requireAuth + loadAccount. */
export function meRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await buildMe(accountOf(res).user));
  });

  // Set a password (Google-only accounts) or change it (requires the current one).
  router.patch('/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const badPassword = passwordError(newPassword);
    if (badPassword) return void res.status(400).json({ error: badPassword });

    const { user } = accountOf(res);
    if (user.passwordHash && !(typeof currentPassword === 'string' && (await checkPassword(currentPassword, user.passwordHash)))) {
      return void res.status(400).json({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' });
    }
    await User.updateOne({ _id: user._id }, { passwordHash: await hashPassword(newPassword) });
    res.status(204).end();
  });

  return router;
}
