import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { PLAN_ERROR_CODES } from '../api-types';
import { UpgradePromptService } from '../upgrade-prompt.service';

/** A 403 PLAN_LIMIT / PRO_FEATURE from any request opens the upgrade dialog (the error still reaches the caller). */
@Injectable()
export class PlanErrorInterceptor implements HttpInterceptor {
  constructor(private upgrade: UpgradePromptService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 403 && (PLAN_ERROR_CODES as readonly string[]).includes(err.error?.code)) {
          this.upgrade.open(err.error.error ?? 'This needs Zelqit Pro.');
        }
        return throwError(() => err);
      }),
    );
  }
}
