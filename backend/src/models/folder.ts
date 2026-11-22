import { Schema, model } from 'mongoose';

const folderSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);
folderSchema.index({ owner: 1, name: 1 }, { unique: true }); // names are unique per user

export const Folder = model('Folder', folderSchema);
