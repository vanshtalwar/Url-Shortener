const TOTAL = 100;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** `count` integer weights summing to 100, as even as possible (earlier ones get the remainder). Pure. */
export function evenWeights(count: number): number[] {
  const base = Math.floor(TOTAL / count);
  return Array.from({ length: count }, (_, i) => base + (i < TOTAL % count ? 1 : 0));
}

/**
 * Sets weight `index` to `value` (clamped so every other weight can keep at least 1) and shares the rest
 * between the others in proportion to their current weights. Result: integers ≥ 1 summing to 100. Pure.
 */
export function rebalance(weights: number[], index: number, value: number): number[] {
  const others = weights.map((_, i) => i).filter((i) => i !== index);
  const fixed = Math.min(Math.max(Math.round(value), 1), TOTAL - others.length);
  const spare = TOTAL - fixed - others.length; // after giving each other weight its minimum of 1

  // Largest-remainder split of `spare`, proportional to each other weight's share above 1.
  const basis = others.map((i) => Math.max(weights[i] - 1, 0));
  const basisTotal = sum(basis);
  const exact = basis.map((b) => (basisTotal > 0 ? (b / basisTotal) * spare : spare / others.length));
  const shares = exact.map(Math.floor);
  const byRemainder = exact.map((x, k) => ({ k, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  const leftover = spare - sum(shares); // computed once: the loop below changes `shares`
  for (let n = 0; n < leftover; n++) shares[byRemainder[n].k] += 1;

  const next = [...weights];
  next[index] = fixed;
  others.forEach((i, k) => (next[i] = 1 + shares[k]));
  return next;
}
