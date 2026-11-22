import { Schema, model } from 'mongoose';

const clickSchema = new Schema({
  link: { type: Schema.Types.ObjectId, ref: 'Link', required: true },
  clickedAt: { type: Date, default: Date.now },
  referrer: { type: String, default: '' }, // hostname only; '' = direct / unknown
  browser: { type: String, default: 'Unknown' },
  os: { type: String, default: 'Unknown' },
  deviceType: { type: String, default: 'unknown' },
  isBot: { type: Boolean, default: false },
  visitorHash: { type: String, required: true }, // sha256(salt + ip + user-agent); raw IP never stored
  variantUrl: { type: String, default: null }, // A/B destination served; null for single-destination links
  country: { type: String, default: 'Unknown' }, // ISO code from GeoLite2
  city: { type: String, default: 'Unknown' },
});
// Every click query filters by link, and almost all by isBot too.
clickSchema.index({ link: 1, isBot: 1 });

export const Click = model('Click', clickSchema);
