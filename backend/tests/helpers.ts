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
  return { sub: `google-${name}`, email: `${name}@example.com`, name };
};

export function testApp(options: AppOptions = {}) {
  return createApp({ verifyGoogleToken: fakeVerifyGoogleToken, ...options });
}

/** Logs in via the real auth route and returns the JWT. */
export async function loginAs(app: ReturnType<typeof createApp>, name: string): Promise<string> {
  const res = await request(app).post('/api/auth/google').send({ credential: `good:${name}` });
  return res.body.token;
}
