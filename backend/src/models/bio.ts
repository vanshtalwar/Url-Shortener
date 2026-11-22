import { Schema, Types, model } from 'mongoose';

export const BIO_THEMES = ['violet', 'midnight', 'light'] as const;

export interface BioRecord {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  handle: string;
  title: string;
  description: string;
  theme: (typeof BIO_THEMES)[number];
  links: { linkId: Types.ObjectId; label: string }[];
}

const bioSchema = new Schema<BioRecord>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // one page per user
    handle: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    theme: { type: String, enum: BIO_THEMES, default: 'violet' },
    links: { type: [{ _id: false, linkId: { type: Schema.Types.ObjectId, ref: 'Link', required: true }, label: { type: String, required: true } }], default: [] },
  },
  { timestamps: true },
);

export const Bio = model('Bio', bioSchema);
