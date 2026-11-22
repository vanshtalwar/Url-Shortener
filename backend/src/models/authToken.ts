import { Schema, model } from 'mongoose';

const authTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: ['verify-email', 'reset-password'], required: true },
  tokenHash: { type: String, required: true, unique: true }, // sha256 of the emailed token; the token itself is never stored
  expiresAt: { type: Date, required: true },
});
// MongoDB deletes expired tokens on its own.
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthToken = model('AuthToken', authTokenSchema);
