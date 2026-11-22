import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

/** The signed-in user as kept in the browser (a subset of the API's `me.user`). */
interface User {
  id: string;
  email: string;
}

/** Response of every endpoint that signs the user in (see the API contract). */
interface Session {
  token: string;
  me: { user: User };
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const authUrl = `${environment.apiUrl}/api/auth`;

function readStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null; // corrupted storage: treat as logged out
  }
}

/** Expiry of a JWT in ms since epoch, or null if the token can't be read. Pure. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Read once; templates read `user` on every change detection.
  private currentUser: User | null = readStoredUser();

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get user(): User | null {
    return this.currentUser;
  }

  /** True only with a token that hasn't expired yet. */
  isLoggedIn(now = Date.now()): boolean {
    const token = this.token;
    return token !== null && (tokenExpiry(token) ?? 0) > now;
  }

  /** Exchanges a Google ID token for our own JWT. */
  loginWithGoogle(credential: string): Observable<Session> {
    return this.http.post<Session>(`${authUrl}/google`, { credential }).pipe(tap((s) => this.saveSession(s)));
  }

  loginWithPassword(email: string, password: string): Observable<Session> {
    return this.http.post<Session>(`${authUrl}/login`, { email, password }).pipe(tap((s) => this.saveSession(s)));
  }

  /** Creates an unverified account and emails a verification link (no session yet). */
  register(email: string, password: string): Observable<unknown> {
    return this.http.post(`${authUrl}/register`, { email, password });
  }

  /** Uses the emailed token; signs the user in on success. */
  verifyEmail(token: string): Observable<Session> {
    return this.http.post<Session>(`${authUrl}/verify-email`, { token }).pipe(tap((s) => this.saveSession(s)));
  }

  resendVerification(email: string): Observable<unknown> {
    return this.http.post(`${authUrl}/resend-verification`, { email });
  }

  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${authUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<unknown> {
    return this.http.post(`${authUrl}/reset-password`, { token, password });
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser = null;
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private saveSession({ token, me }: Session): void {
    const user = { id: me.user.id, email: me.user.email };
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser = user;
  }
}
