import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { IconName } from '../ui/icon.component';

interface FeatureGroup {
  icon: IconName;
  title: string;
  pro: boolean;
  points: string[];
}

@Component({
  selector: 'app-features',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 pb-10 pt-16 lg:pt-24">
      <h1 class="max-w-3xl text-4xl font-bold sm:text-5xl">Everything Zelqit does</h1>
      <p class="mt-4 max-w-2xl text-lg text-muted">Short links, the analytics behind them, and the tools to organise and test your campaigns.</p>
    </section>
    <section class="mx-auto grid max-w-6xl gap-4 px-4 pb-20 md:grid-cols-2">
      <z-card *ngFor="let g of groups">
        <div class="flex items-start justify-between gap-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-glow"><z-icon [name]="g.icon" [size]="20"></z-icon></div>
          <z-badge [tone]="g.pro ? 'pro' : 'neutral'">{{ g.pro ? 'Pro' : 'All plans' }}</z-badge>
        </div>
        <h2 class="mt-4 text-xl font-semibold">{{ g.title }}</h2>
        <ul class="mt-3 space-y-2 text-sm text-muted">
          <li *ngFor="let p of g.points" class="flex gap-2"><z-icon name="check" [size]="16" class="mt-0.5 text-accent"></z-icon>{{ p }}</li>
        </ul>
      </z-card>
    </section>
    <section class="px-4 pb-20 text-center">
      <a zButton routerLink="/signup" size="lg">Start free</a>
      <a zButton routerLink="/pricing" variant="ghost" size="lg" class="ml-2">Compare plans</a>
    </section>
  `,
})
export class FeaturesComponent {
  readonly groups: FeatureGroup[] = [
    { icon: 'link', title: 'Short links', pro: false, points: ['Random 7-character codes or your own alias', 'Change the destination any time', 'Optional expiry date — the link switches off on its own', 'Copy or open with one click'] },
    { icon: 'chart', title: 'Click analytics', pro: false, points: ['Clicks and unique visitors per day', 'Top referring sites, browsers, operating systems and devices', 'Bots detected and shown separately', 'Free: last 30 days · Pro: full history'] },
    { icon: 'qr', title: 'QR codes', pro: false, points: ['A QR code for every link', 'Download as PNG for print and slides', 'Scans are counted like any other click'] },
    { icon: 'lock', title: 'Password-protected links', pro: false, points: ['Visitors enter a password before the redirect', 'Repeated wrong guesses are slowed down', 'Change or remove the password later'] },
    { icon: 'globe', title: 'Country & city analytics', pro: true, points: ['Where your visitors are, by country and city', 'Approximate location from an on-server lookup', 'No raw IP addresses stored'] },
    { icon: 'zap', title: 'A/B destination splits', pro: true, points: ['Send one link to 2–5 destinations by weight', 'See clicks for each destination', 'Change weights without losing history'] },
    { icon: 'folder', title: 'Folders, tags & UTM presets', pro: true, points: ['Group links into folders and tag them', 'Filter and search your links', 'Build UTM-tagged URLs and save presets'] },
    { icon: 'sparkles', title: 'Link-in-bio page', pro: true, points: ['One public page at /@your-name', 'Pick the links and labels to show', 'Every tap is tracked through your short links'] },
  ];
}
