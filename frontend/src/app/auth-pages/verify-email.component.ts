import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { apiError } from '../api-error';

/** Landing page for the emailed verification link (/verify-email?token=…). */
@Component({
  selector: 'app-verify-email',
  template: `
    <z-card class="!p-8 text-center">
      <ng-container *ngIf="!error; else failed">
        <z-icon name="loader" [size]="28" class="animate-spin text-accent"></z-icon>
        <h1 class="mt-4 text-2xl font-bold">Verifying your email…</h1>
      </ng-container>
      <ng-template #failed>
        <h1 class="text-2xl font-bold">This link didn't work</h1>
        <p role="alert" class="mt-2 text-sm text-muted">{{ error }}</p>
        <form class="mt-6 space-y-3 text-left" (ngSubmit)="resend()">
          <label for="email" class="block text-sm font-medium">Send a new link to</label>
          <input id="email" name="email" type="email" zInput autocomplete="email" required [(ngModel)]="email" />
          <button zButton type="submit" class="w-full" [disabled]="!email" [loading]="busy">Send new link</button>
        </form>
        <p *ngIf="notice" role="status" class="mt-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{{ notice }}</p>
      </ng-template>
    </z-card>
  `,
})
export class VerifyEmailComponent implements OnInit {
  error = '';
  notice = '';
  email = '';
  busy = false;

  constructor(private route: ActivatedRoute, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error = 'The verification link is missing its code.';
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: () => this.router.navigate(['/app']),
      error: (err) => (this.error = apiError(err).message),
    });
  }

  resend(): void {
    this.busy = true;
    this.auth.resendVerification(this.email.trim()).subscribe({
      next: () => {
        this.notice = 'If that address has an unverified account, a new link is on its way.';
        this.busy = false;
      },
      error: (err) => {
        this.error = apiError(err).message;
        this.busy = false;
      },
    });
  }
}
