import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

async function main() {
  await mongoose.connect(config.mongodbUri());
  console.log('Connected to MongoDB');

  createApp().listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
