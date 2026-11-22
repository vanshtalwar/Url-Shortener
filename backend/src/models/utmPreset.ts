import { Schema, model } from 'mongoose';

const utmPresetSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    source: { type: String, required: true },
    medium: { type: String, required: true },
    campaign: { type: String, required: true },
    term: { type: String, default: '' },
    content: { type: String, default: '' },
  },
  { timestamps: true },
);

export const UtmPreset = model('UtmPreset', utmPresetSchema);
