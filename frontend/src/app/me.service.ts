import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, shareReplay, startWith, switchMap } from 'rxjs';
import { environment } from '../environments/environment';
import type { Me } from './api-types';

/**
 * The signed-in user's plan, limits and usage, shared across the app. The app shell calls refresh() when it
 * opens (so a new login never sees the previous account); call it again after changes. null = loading.
 */
@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly reload$ = new ReplaySubject<void>(1);
  readonly me$: Observable<Me | null> = this.reload$.pipe(
    switchMap(() => this.http.get<Me>(`${environment.apiUrl}/api/me`).pipe(startWith(null))),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor(private http: HttpClient) {}

  refresh(): void {
    this.reload$.next();
  }

  /** Creates a Razorpay subscription to pay for in Checkout. */
  startSubscription(interval: 'monthly' | 'yearly'): Observable<{ subscriptionId: string; keyId: string }> {
    return this.http.post<{ subscriptionId: string; keyId: string }>(`${environment.apiUrl}/api/billing/subscribe`, { interval });
  }

  /** Sends Checkout's signed response to the API, which confirms with Razorpay before upgrading. */
  verifyPayment(response: object): Observable<Me> {
    return this.http.post<Me>(`${environment.apiUrl}/api/billing/verify`, response);
  }

  cancelSubscription(): Observable<Me> {
    return this.http.post<Me>(`${environment.apiUrl}/api/billing/cancel`, {});
  }

  changePassword(newPassword: string, currentPassword?: string): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/api/me/password`, { newPassword, ...(currentPassword ? { currentPassword } : {}) });
  }
}
