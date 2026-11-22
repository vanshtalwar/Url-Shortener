import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { apiError } from '../api-error';

@Component({
  selector: 'app-check-email',
  template: `
    <z-card class="!p-8 text-center">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-glow"><z-icon name="sparkles" [size]="22"></z-icon></div>
      <h1 class="mt-5 text-2xl font-bold">Check your email</h1>
      <p class="mt-2 text-sm text-muted">
        We sent a verification link to <strong class="text-ink">{{ email || 'your inbox' }}</strong>. Open it to finish creating your account.
        The link works for 24 hours.
      </p>
      <p class="mt-4 text-xs text-muted">Nothing there? Check spam, or send it again.</p>
      <p *ngIf="notice" role="status" class="mt-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{{ notice }}</p>
      <p *ngIf="error" role="alert" class="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>
      <button *ngIf="email" zButton variant="secondary" class="mt-6" [loading]="busy" (click)="resend()">Resend email</button>
      <p class="mt-6 text-sm"><a routerLink="/login" class="text-accent hover:underline">Back to log in</a></p>
    </z-card>
  `,
})
export class CheckEmailComponent {
  readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';
  busy = false;
  notice = '';
  error = '';

  constructor(private route: ActivatedRoute, private auth: AuthService) {}

  resend(): void {
    this.busy = true;
    this.error = this.notice = '';
    this.auth.resendVerification(this.email).subscribe({
      next: () => {
        this.notice = 'Sent again. It can take a minute to arrive.';
        this.busy = false;
      },
      error: (err) => {
        this.error = apiError(err).message;
        this.busy = false;
      },
    });
  }
}
