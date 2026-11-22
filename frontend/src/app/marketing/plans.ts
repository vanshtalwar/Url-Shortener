/**
 * Single source for plan prices and features shown on the marketing site (landing teaser, pricing cards and
 * comparison table). Must match the backend's entitlements (backend/src/plans.ts) — update both together.
 */
export const PRICES = {
  monthly: 199, // ₹ per month
  yearly: 1990, // ₹ per year (2 months free)
} as const;

interface PlanFeature {
  label: string;
  free: boolean | string; // string = a limit, e.g. "25 / month"
  pro: boolean | string;
}

export const PLAN_FEATURES: PlanFeature[] = [
  { label: 'Short links', free: '25 new / month', pro: 'Unlimited' },
  { label: 'Analytics history', free: 'Last 30 days', pro: 'Full history' },
  { label: 'Custom aliases, QR codes, link expiry', free: true, pro: true },
  { label: 'Password-protected links', free: true, pro: true },
  { label: 'Clicks, unique visitors, sources, devices', free: true, pro: true },
  { label: 'Bot filtering', free: true, pro: true },
  { label: 'Country & city analytics', free: false, pro: true },
  { label: 'Folders & tags', free: false, pro: true },
  { label: 'UTM builder & saved presets', free: false, pro: true },
  { label: 'A/B destination splits', free: false, pro: true },
  { label: 'Link-in-bio page', free: false, pro: true },
];

/** "₹1,990" — Indian number formatting. Pure. */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
