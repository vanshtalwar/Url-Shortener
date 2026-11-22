// WCAG AA contrast for every text/background token pair in src/styles.css: the light and dark themes and
// each landing-section palette ([data-palette='…']). Run after any colour change:
//   node scripts/ui-check/contrast.mjs        (from frontend/; any Node version, no dependencies)
// Exits 1 if a pair is below 4.5:1 or a palette leaves a colour token undefined.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Every block that sets colour tokens, in source order: { selectors: [...], tokens: { name: [r, g, b] } }.
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*--[^{}]*)\}/g)].map(([, selector, body]) => ({
  selectors: selector.split(',').map((s) => s.trim()),
  tokens: Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)].map(([, name, r, g, b]) => [name, [+r, +g, +b]])),
}));
const merged = (...selectors) => Object.assign({}, ...blocks.filter((b) => b.selectors.some((s) => selectors.includes(s))).map((b) => b.tokens));

const themes = { light: merged(':root'), dark: { ...merged(':root'), ...merged('.dark') } };
const palettes = [...new Set(blocks.flatMap((b) => b.selectors).map((s) => /^\[data-palette='([\w-]+)'\]$/.exec(s)?.[1]).filter(Boolean))];

// A section must not inherit colours from the page theme, or it would change with light/dark mode.
const OWN = ['canvas', 'surface', 'surface-2', 'line', 'ink', 'muted', 'accent', 'brand-glow', 'headline-accent', 'success', 'warning', 'danger'];
const TEXT = ['ink', 'muted', 'accent', 'success', 'warning', 'danger'];
const BACKGROUNDS = ['canvas', 'surface', 'surface-2'];

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failures = 0;
const report = (label, value, min = 4.5) => {
  const ok = value >= min;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(44)} ${value.toFixed(2)}`);
};

const sets = { ...themes };
for (const name of palettes) {
  const own = merged(`[data-palette='${name}']`);
  const missing = OWN.filter((t) => !own[t]);
  if (missing.length) {
    failures++;
    console.log(`FAIL palette ${name} does not set: ${missing.join(', ')}`);
  }
  sets[`palette ${name}`] = { ...themes.light, ...own }; // brand-from/to are the same in both themes
}

for (const [name, t] of Object.entries(sets)) {
  if (t['headline-accent']) report(`${name}: headline-accent on canvas`, ratio(t['headline-accent'], t.canvas));
  for (const fg of TEXT) {
    const [bg, value] = BACKGROUNDS.map((bg) => [bg, ratio(t[fg], t[bg])]).sort((a, b) => a[1] - b[1])[0];
    report(`${name}: ${fg} on ${bg} (worst)`, value);
  }
}
// Primary buttons and the landing's final CTA: white text on both ends of each gradient.
for (const end of ['brand-from', 'brand-to', 'cta-from', 'cta-to']) report(`white on ${end}`, ratio([255, 255, 255], themes.light[end]));

console.log(failures ? `\n${failures} problem(s)` : '\nAll pairs pass WCAG AA (4.5:1).');
process.exit(failures ? 1 : 0);
