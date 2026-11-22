import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

async function main() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const server = createApp().listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });

  // Render sends SIGTERM before replacing the instance: finish in-flight requests, then close the DB.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
