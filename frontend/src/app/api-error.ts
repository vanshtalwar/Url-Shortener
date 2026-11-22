import { HttpErrorResponse } from '@angular/common/http';

/** The API's `{ error, code }`, with a friendly fallback for network failures. Pure. */
export function apiError(err: HttpErrorResponse): { message: string; code?: string } {
  if (err.status === 0) return { message: "Can't reach Zelqit right now. Check your connection and try again." };
  if (err.status === 429) return { message: 'Too many attempts. Please wait a few minutes and try again.' };
  return { message: err.error?.error ?? 'Something went wrong. Please try again.', code: err.error?.code };
}
