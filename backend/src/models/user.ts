import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, default: '' },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
