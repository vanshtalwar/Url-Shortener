import { Schema, Types, model, type InferSchemaType } from 'mongoose';

const subscriptionSchema = new Schema(
  {
    id: { type: String, required: true }, // Razorpay subscription id
    status: { type: String, required: true }, // Razorpay status, e.g. active, cancelled, halted
    interval: { type: String, enum: ['monthly', 'yearly'], required: true },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    lastEventAt: { type: Number, default: null }, // Unix seconds of the newest Razorpay state applied
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    googleId: { type: String, unique: true, sparse: true }, // absent for password-only accounts
    passwordHash: { type: String }, // absent for Google-only accounts
    subscription: { type: subscriptionSchema, default: null },
  },
  { timestamps: true },
);

userSchema.index({ 'subscription.id': 1 }, { sparse: true }); // webhook lookups

export const User = model('User', userSchema);
export type UserRecord = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
