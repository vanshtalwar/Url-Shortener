import { Schema, Types, model, type InferSchemaType } from 'mongoose';

const linkSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Serves "my links, newest first" without an in-memory sort.
linkSchema.index({ owner: 1, createdAt: -1, _id: -1 });

export const Link = model('Link', linkSchema);
export type LinkRecord = InferSchemaType<typeof linkSchema> & { _id: Types.ObjectId };
