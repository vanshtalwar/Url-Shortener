import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { apiError } from '../api-error';

const MIN_PASSWORD = 8;

/** Landing page for the emailed reset link (/reset-password?token=…). */
@Component({
  selector: 'app-reset-password',
  template: `
    <z-card class="!p-8">
      <h1 class="text-2xl font-bold">Choose a new password</h1>
      <ng-container *ngIf="token; else missing">
        <form *ngIf="!done; else success" (ngSubmit)="submit()" class="mt-6 space-y-4">
          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium">New password</label>
            <input id="password" name="password" type="password" zInput autocomplete="new-password" required [(ngModel)]="password" />
            <p class="mt-1.5 text-xs text-muted">At least {{ minPassword }} characters.</p>
          </div>
          <div>
            <label for="confirm" class="mb-1.5 block text-sm font-medium">Confirm password</label>
            <input id="confirm" name="confirm" type="password" zInput autocomplete="new-password" required [(ngModel)]="confirm" />
            <p *ngIf="confirm && confirm !== password" class="mt-1.5 text-xs text-warning">Passwords don't match.</p>
          </div>
          <p *ngIf="error" role="alert" class="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {{ error }} <a *ngIf="expired" routerLink="/forgot-password" class="font-medium underline">Get a new link</a>
          </p>
          <button zButton type="submit" class="w-full" [loading]="busy" [disabled]="password.length < minPassword || password !== confirm">Save password</button>
        </form>
      </ng-container>
      <ng-template #success>
        <p role="status" class="mt-6 rounded-xl bg-success/10 px-3 py-3 text-sm text-success">Your password has been changed.</p>
        <a zButton routerLink="/login" class="mt-6 w-full">Log in</a>
      </ng-template>
      <ng-template #missing>
        <p class="mt-3 text-sm text-muted">This reset link is incomplete.</p>
        <a zButton routerLink="/forgot-password" variant="secondary" class="mt-6 w-full">Request a new link</a>
      </ng-template>
    </z-card>
  `,
})
export class ResetPasswordComponent {
  readonly minPassword = MIN_PASSWORD;
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  password = '';
  confirm = '';
  busy = false;
  done = false;
  error = '';
  expired = false;

  constructor(private route: ActivatedRoute, private auth: AuthService) {}

  submit(): void {
    this.busy = true;
    this.error = '';
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: () => (this.done = true),
      error: (err) => {
        const { message, code } = apiError(err);
        this.error = message;
        this.expired = code === 'INVALID_TOKEN';
        this.busy = false;
      },
    });
  }
}
