interface Weighted {
  readonly url: string;
  readonly weight: number;
}

/** Picks a destination by relative weight. `random` is a number in [0, 1) (inject it for deterministic tests). Pure. */
export function pickVariant<T extends Weighted>(variants: readonly T[], random: number): T {
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  let point = random * total;
  for (const variant of variants) {
    point -= variant.weight;
    if (point < 0) return variant;
  }
  return variants[variants.length - 1]; // guards against floating-point rounding at the very top
}
