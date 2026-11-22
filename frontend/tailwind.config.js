/** Colours come from CSS variables in src/styles.css, so light/dark is one class switch on <html>. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'), // page background
        surface: token('surface'), // cards, panels
        'surface-2': token('surface-2'), // inputs, table headers, hovers
        line: token('line'), // 1px borders
        ink: token('ink'), // primary text
        muted: token('muted'), // secondary text
        accent: token('accent'), // links / highlighted text (readable on canvas)
        brand: { from: token('brand-from'), to: token('brand-to'), glow: token('brand-glow') },
        tint: token('tint'), // landing-section accent: 3D, decoration, never text on cream/lavender
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'], // italic accent words in the landing headlines
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, rgb(var(--brand-from)), rgb(var(--brand-to)))',
        cta: 'linear-gradient(135deg, rgb(var(--cta-from)), rgb(var(--cta-to)))',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.18)',
        glow: '0 8px 30px -8px rgb(var(--brand-glow) / 0.55)',
      },
      borderRadius: { xl: '10px', '2xl': '16px' },
      transitionDuration: { DEFAULT: '200ms' },
      keyframes: { marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } } },
      animation: { marquee: 'marquee 40s linear infinite' },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
