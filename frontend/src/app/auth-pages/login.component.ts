import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { apiError } from '../api-error';

@Component({
  selector: 'app-login',
  template: `
    <z-card class="!p-8">
      <h1 class="text-2xl font-bold">Welcome back</h1>
      <p class="mt-1 text-sm text-muted">Log in to your Zelqit dashboard.</p>

      <app-google-button class="mt-6" (signedIn)="done()" (failed)="error = $event"></app-google-button>
      <div class="my-6 flex items-center gap-3 text-xs text-muted"><span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span></div>

      <form (ngSubmit)="submit()" class="space-y-4" novalidate>
        <div>
          <label for="email" class="mb-1.5 block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" zInput autocomplete="email" required [(ngModel)]="email" />
        </div>
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <label for="password" class="text-sm font-medium">Password</label>
            <a routerLink="/forgot-password" [queryParams]="email ? { email: email } : {}" class="text-xs text-accent hover:underline">Forgot password?</a>
          </div>
          <input id="password" name="password" type="password" zInput autocomplete="current-password" required [(ngModel)]="password" />
        </div>

        <div *ngIf="error" role="alert" class="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {{ error }}
          <button *ngIf="unverified" type="button" class="ml-1 font-medium underline" (click)="resend()">Resend verification email</button>
        </div>
        <p *ngIf="notice" role="status" class="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{{ notice }}</p>

        <button zButton type="submit" class="w-full" [loading]="busy" [disabled]="!email || !password">Log in</button>
      </form>
      <p class="mt-6 text-center text-sm text-muted">New to Zelqit? <a routerLink="/signup" class="font-medium text-accent hover:underline">Create an account</a></p>
    </z-card>
  `,
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  busy = false;
  error = '';
  notice = '';
  unverified = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) this.done();
  }

  submit(): void {
    this.error = this.notice = '';
    this.unverified = false;
    this.busy = true;
    this.auth.loginWithPassword(this.email.trim(), this.password).subscribe({
      next: () => this.done(),
      error: (err) => {
        const { message, code } = apiError(err);
        this.error = message;
        this.unverified = code === 'EMAIL_NOT_VERIFIED';
        this.busy = false;
      },
    });
  }

  resend(): void {
    this.auth.resendVerification(this.email.trim()).subscribe({
      next: () => {
        this.error = '';
        this.unverified = false;
        this.notice = 'Verification email sent. Check your inbox.';
      },
      error: (err) => (this.error = apiError(err).message),
    });
  }

  done(): void {
    this.router.navigate(['/app']);
  }
}
