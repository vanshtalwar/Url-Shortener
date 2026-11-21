import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Adds the JWT to API calls; an expired or invalid JWT (401) logs the user out. */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.token;
    if (!token || !req.url.startsWith(environment.apiUrl)) return next.handle(req);

    const authed = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    return next.handle(authed).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) this.auth.logout();
        return throwError(() => err);
      }),
    );
  }
}
