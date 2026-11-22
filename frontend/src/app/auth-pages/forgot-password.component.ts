import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { apiError } from '../api-error';

@Component({
  selector: 'app-forgot-password',
  template: `
    <z-card class="!p-8">
      <h1 class="text-2xl font-bold">Reset your password</h1>
      <p class="mt-1 text-sm text-muted">Enter your account's email and we'll send a reset link. It also lets Google-only accounts add a password.</p>
      <form *ngIf="!sent; else done" (ngSubmit)="submit()" class="mt-6 space-y-4">
        <div>
          <label for="email" class="mb-1.5 block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" zInput autocomplete="email" required [(ngModel)]="email" />
        </div>
        <p *ngIf="error" role="alert" class="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>
        <button zButton type="submit" class="w-full" [loading]="busy" [disabled]="!email">Send reset link</button>
      </form>
      <ng-template #done>
        <!-- Same message whether or not the account exists, matching the API. -->
        <p role="status" class="mt-6 rounded-xl bg-success/10 px-3 py-3 text-sm text-success">
          If an account exists for {{ email }}, a reset link is on its way. It works for 1 hour.
        </p>
      </ng-template>
      <p class="mt-6 text-center text-sm"><a routerLink="/login" class="text-accent hover:underline">Back to log in</a></p>
    </z-card>
  `,
})
export class ForgotPasswordComponent {
  email = this.route.snapshot.queryParamMap.get('email') ?? '';
  busy = false;
  sent = false;
  error = '';

  constructor(private route: ActivatedRoute, private auth: AuthService) {}

  submit(): void {
    this.busy = true;
    this.error = '';
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => (this.sent = true),
      error: (err) => {
        this.error = apiError(err).message;
        this.busy = false;
      },
    });
  }
}
