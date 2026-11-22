import { create } from 'qrcode';

// Where the cubes go in each formation, in formation units (one cube = 1 unit). Pure apart from the QR library.

export interface Slot {
  x: number;
  y: number;
  z: number;
}

/** The dark modules of a real QR code for `text`, centred on the origin, y up. `size` = modules per side. */
export function qrSlots(text: string): { size: number; slots: Slot[] } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const half = (modules.size - 1) / 2;
  const slots: Slot[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) slots.push({ x: column - half, y: half - row, z: 0 });
    }
  }
  return { size: modules.size, slots };
}

/** Bars sit on the floor (y = 0) along x, this far apart. A bar is 2 × 2 cubes across. */
export const BAR_PITCH = 3;

/**
 * Stacks exactly `count` cubes into bars proportional to `values`: 2 × 2 cubes per layer, bottom layers first so
 * the cubes can rise in order. Cubes that don't fill a layer top up the tallest bars. Bars centred on x = 0.
 */
export function barSlots(count: number, values: number[]): Slot[] {
  const layers = Math.floor(count / 4);
  const total = values.reduce((sum, v) => sum + v, 0);
  const heights = values.map((v) => Math.max(1, Math.floor((v / total) * layers)));
  // Rounding leaves some layers over: give them to the tallest bars first.
  const byHeight = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
  for (let spare = layers - heights.reduce((sum, h) => sum + h, 0), k = 0; spare > 0; spare--, k++) heights[byHeight[k % values.length]]++;

  const slots: Slot[] = [];
  const left = -((values.length - 1) * BAR_PITCH) / 2;
  const tallest = Math.max(...heights);
  for (let layer = 0; layer < tallest; layer++) {
    heights.forEach((height, bar) => {
      if (layer >= height) return;
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        slots.push({ x: left + bar * BAR_PITCH + dx, y: layer + 0.5, z: dz });
      }
    });
  }
  // The last count % 4 cubes start a new layer on the tallest bar.
  const top = byHeight[0];
  for (let i = 0; slots.length < count; i++) {
    const [dx, dz] = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]][i];
    slots.push({ x: left + top * BAR_PITCH + dx, y: heights[top] + 0.5, z: dz });
  }
  return slots;
}

/** Height (in cubes) of the tallest bar that barSlots builds, i.e. where the link can rest. */
export function tallestBar(slots: Slot[]): Slot {
  return slots.reduce((top, s) => (s.y > top.y ? s : top), slots[0]);
}
