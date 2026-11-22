import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface User {
  id: string;
  email: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

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
  login(credential: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/auth/google`, { credential }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this.currentUser = res.user;
      }),
    );
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
}
