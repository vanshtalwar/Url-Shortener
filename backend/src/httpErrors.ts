import type { Response } from 'express';

type ForbiddenCode = 'EMAIL_NOT_VERIFIED' | 'PLAN_LIMIT' | 'PRO_FEATURE';

export function forbidden(res: Response, error: string, code: ForbiddenCode): void {
  res.status(403).json({ error, code });
}

/** 403 for a Pro-only action, e.g. proRequired(res, 'folders'). */
export function proRequired(res: Response, feature: string): void {
  forbidden(res, `Pro feature: ${feature}`, 'PRO_FEATURE');
}
