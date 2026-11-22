// Loaded by Jest before every test file (see jest.config.js), before src/config.ts reads the environment.
process.env.FRONTEND_ORIGIN = 'http://localhost:4200';
process.env.MONGODB_URI = 'mongodb://unused-in-tests'; // tests use mongodb-memory-server
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.VISITOR_HASH_SALT = 'test-salt';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'unused'; // tests use a fake mailer
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'test-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.RAZORPAY_PLAN_MONTHLY = 'plan_monthly';
process.env.RAZORPAY_PLAN_YEARLY = 'plan_yearly';
