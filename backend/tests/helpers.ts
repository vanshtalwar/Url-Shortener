import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp, type AppOptions } from '../src/app';
import type { VerifyGoogleToken } from '../src/routes/auth';

/** Starts an in-memory MongoDB for the test file and empties it between tests. */
export function useTestDb() {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
}

/** Fake Google check: "good:<name>" is valid, anything else is rejected. */
export const fakeVerifyGoogleToken: VerifyGoogleToken = async (credential) => {
  if (!credential.startsWith('good:')) throw new Error('invalid');
  const name = credential.slice(5);
  return { sub: `google-${name}`, email: `${name}@example.com`, emailVerified: !name.startsWith('unverified') };
};

/** Records every email instead of sending it; `lastToken()` pulls the token out of the newest link. */
export function fakeMailer() {
  const sent: { kind: 'verify' | 'reset'; to: string; link: string }[] = [];
  return {
    sent,
    lastToken: () => new URL(sent[sent.length - 1].link).searchParams.get('token')!,
    sendVerification: async (to: string, link: string) => void sent.push({ kind: 'verify', to, link }),
    sendPasswordReset: async (to: string, link: string) => void sent.push({ kind: 'reset', to, link }),
  };
}

/** In-memory stand-in for Razorpay. `state` holds what Razorpay would report for each subscription. */
export function fakeBilling() {
  const state = new Map<string, { id: string; status: string; current_end: number | null }>();
  const calls: { method: string; args: unknown[] }[] = [];
  let next = 1;
  return {
    state,
    calls,
    createSubscription: async (planId: string, totalCount: number, notes: Record<string, string>) => {
      calls.push({ method: 'create', args: [planId, totalCount, notes] });
      const sub = { id: `sub_${next++}`, status: 'created', current_end: null };
      state.set(sub.id, sub);
      return sub;
    },
    fetchSubscription: async (id: string) => state.get(id)!,
    cancelAtCycleEnd: async (id: string) => {
      calls.push({ method: 'cancel', args: [id] });
      return state.get(id)!; // Razorpay keeps it active until the cycle ends
    },
  };
}

export function testApp(options: AppOptions = {}) {
  const geo = async () => ({ country: 'Unknown', city: 'Unknown' });
  return createApp({ verifyGoogleToken: fakeVerifyGoogleToken, mailer: fakeMailer(), billing: fakeBilling(), geo, ...options });
}

/** Human clicks for one link, as the dashboard list reports them. */
export async function listedClickCount(app: ReturnType<typeof createApp>, auth: object, code: string) {
  const res = await request(app).get('/api/links').set(auth as Record<string, string>);
  return res.body.find((l: { code: string }) => l.code === code)?.clickCount;
}

/** Logs in via the real auth route and returns the JWT. */
export async function loginAs(app: ReturnType<typeof createApp>, name: string): Promise<string> {
  const res = await request(app).post('/api/auth/google').send({ credential: `good:${name}` });
  return res.body.token;
}
