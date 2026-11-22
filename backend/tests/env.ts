// Loaded by Jest before every test file (see jest.config.js), before src/config.ts reads the environment.
process.env.FRONTEND_ORIGIN = 'http://localhost:4200';
process.env.MONGODB_URI = 'mongodb://unused-in-tests'; // tests use mongodb-memory-server
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.VISITOR_HASH_SALT = 'test-salt';
