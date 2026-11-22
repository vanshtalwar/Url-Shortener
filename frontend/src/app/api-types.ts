// Response shapes from the API contract (prompts/zelqit-backend.md → "API contract"). Keep in sync with the backend.

type Plan = 'free' | 'pro';

export interface Me {
  user: { id: string; email: string; emailVerified: boolean; hasPassword: boolean; hasGoogle: boolean; bioHandle: string | null };
  plan: Plan;
  subscription: { status: string; interval: 'monthly' | 'yearly'; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  entitlements: {
    linkLimitPerMonth: number | null;
    historyDays: number | null;
    can: { geo: boolean; utmPresets: boolean; folders: boolean; variants: boolean; bio: boolean };
  };
  usage: { linksThisMonth: number };
}

export interface DayCount {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface Overview {
  days: number; // window actually used (Free is capped at 30)
  totals: { clicks: number; uniques: number; links: number };
  clicksPerDay: DayCount[];
  topLinks: { id: string; code: string; clicks: number }[];
}

/** Error codes the API uses for plan restrictions. */
export const PLAN_ERROR_CODES = ['PLAN_LIMIT', 'PRO_FEATURE'] as const;

export type BioTheme = 'violet' | 'midnight' | 'light';

/** The owner's link-in-bio page (GET/PUT /api/bio). */
export interface Bio {
  handle: string;
  title: string;
  description: string;
  theme: BioTheme;
  links: { linkId: string; label: string }[];
}

/** What visitors see (GET /api/public/bio/:handle). */
export interface PublicBio {
  title: string;
  description: string;
  theme: BioTheme;
  links: { label: string; shortUrl: string }[];
}
