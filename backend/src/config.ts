import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200',
  mongodbUri: () => required('MONGODB_URI'),
  jwtSecret: () => required('JWT_SECRET'),
  googleClientId: () => required('GOOGLE_CLIENT_ID'),
  visitorHashSalt: () => required('VISITOR_HASH_SALT'),
};
