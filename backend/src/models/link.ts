import { Schema, Types, model } from 'mongoose';

/** A link as stored (and as read with `.lean()`). Declared explicitly so lean reads, creates and updates share one type. */
export interface LinkRecord {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  code: string;
  url: string;
  expiresAt: Date | null;
  folderId: Types.ObjectId | null;
  tags: string[];
  passwordHash: string | null;
  variants: { url: string; weight: number }[];
  createdAt: Date;
  updatedAt: Date;
}

const linkSchema = new Schema<LinkRecord>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    expiresAt: { type: Date, default: null },
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    tags: { type: [String], default: [] },
    passwordHash: { type: String, default: null }, // bcrypt; never sent to clients
    // A/B split: when non-empty, these are the destinations (by relative weight) and `url` is not used for redirects.
    variants: { type: [{ _id: false, url: { type: String, required: true }, weight: { type: Number, required: true } }], default: [] },
  },
  { timestamps: true },
);
// Serves "my links, newest first" without an in-memory sort.
linkSchema.index({ owner: 1, createdAt: -1, _id: -1 });
linkSchema.index({ owner: 1, tags: 1 }); // tag filter

export const Link = model('Link', linkSchema);
