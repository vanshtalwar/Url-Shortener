import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { savePendingUrl } from '../pending-url';
import { apiError } from '../api-error';

const MIN_PASSWORD = 8;

@Component({
  selector: 'app-signup',
  template: `
    <z-card class="!p-8">
      <h1 class="text-2xl font-bold">Create your account</h1>
      <p class="mt-1 text-sm text-muted">Free plan · no card needed.</p>

      <app-google-button class="mt-6" (signedIn)="router.navigate(['/app'])" (failed)="error = $event"></app-google-button>
      <div class="my-6 flex items-center gap-3 text-xs text-muted"><span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span></div>

      <form (ngSubmit)="submit()" class="space-y-4" novalidate>
        <div>
          <label for="email" class="mb-1.5 block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" zInput autocomplete="email" required [(ngModel)]="email" />
        </div>
        <div>
          <label for="password" class="mb-1.5 block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" zInput autocomplete="new-password" required [minlength]="minPassword"
                 aria-describedby="password-hint" [(ngModel)]="password" />
          <p id="password-hint" class="mt-1.5 text-xs" [class.text-muted]="password.length >= minPassword || !password" [class.text-warning]="password && password.length < minPassword">
            {{ strengthHint() }}
          </p>
        </div>

        <p *ngIf="error" role="alert" class="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {{ error }} <a *ngIf="taken" routerLink="/login" class="font-medium underline">Log in</a>
        </p>

        <button zButton type="submit" class="w-full" [loading]="busy" [disabled]="!email || password.length < minPassword">Create account</button>
        <p class="text-center text-xs text-muted">
          By signing up you agree to the <a routerLink="/legal/terms" class="underline">Terms</a> and
          <a routerLink="/legal/privacy" class="underline">Privacy Policy</a>.
        </p>
      </form>
      <p class="mt-6 text-center text-sm text-muted">Already have an account? <a routerLink="/login" class="font-medium text-accent hover:underline">Log in</a></p>
    </z-card>
  `,
})
export class SignupComponent implements OnInit {
  readonly minPassword = MIN_PASSWORD;
  email = '';
  password = '';
  busy = false;
  error = '';
  taken = false;

  constructor(private auth: AuthService, public router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // A link typed on the landing page waits for the user's first visit to the links page.
    savePendingUrl(this.route.snapshot.queryParamMap.get('url'));
    if (this.auth.isLoggedIn()) this.router.navigate(['/app']);
  }

  strengthHint(): string {
    if (!this.password) return `At least ${MIN_PASSWORD} characters.`;
    if (this.password.length < MIN_PASSWORD) return `${MIN_PASSWORD - this.password.length} more characters needed.`;
    return this.password.length >= 12 ? 'Strong length.' : 'OK — 12 or more characters is stronger.';
  }

  submit(): void {
    this.error = '';
    this.taken = false;
    this.busy = true;
    const email = this.email.trim();
    this.auth.register(email, this.password).subscribe({
      next: () => this.router.navigate(['/check-email'], { queryParams: { email } }),
      error: (err) => {
        const { message, code } = apiError(err);
        this.error = message;
        this.taken = code === 'EMAIL_TAKEN';
        this.busy = false;
      },
    });
  }
}
