import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Centred card on a soft brand-tinted background, for login / sign-up / password pages. */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div class="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand opacity-20 blur-3xl" aria-hidden="true"></div>
      <div class="absolute right-4 top-4"><z-theme-toggle></z-theme-toggle></div>
      <a routerLink="/" class="relative mb-8 text-ink" aria-label="Zelqit home"><z-logo [size]="36"></z-logo></a>
      <main class="relative w-full max-w-md">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class AuthLayoutComponent {}
