import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const linkSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    expiresAt: { type: Date, default: null },
    // Human (non-bot) clicks only; the stats endpoint has the full breakdown.
    clickCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Link = model('Link', linkSchema);
export type LinkDoc = HydratedDocument<InferSchemaType<typeof linkSchema>> & { _id: Types.ObjectId };

export function serializeLink(link: LinkDoc) {
  return {
    id: link.id as string,
    code: link.code,
    url: link.url,
    expiresAt: link.expiresAt,
    clickCount: link.clickCount,
    createdAt: link.createdAt,
  };
}
