import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import type { IconName } from '../ui/icon.component';
import { PRICES, formatInr } from './plans';

interface Feature {
  icon: IconName;
  title: string;
  body: string;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  demoUrl = '';
  readonly proMonthly = formatInr(PRICES.monthly);

  readonly strip = [
    'Custom aliases', 'QR codes', 'Password-protected links', 'Link expiry', 'A/B destination splits',
    'UTM builder', 'Folders & tags', 'Link-in-bio', 'Bot filtering', 'Country & city stats',
  ];

  readonly features: Feature[] = [
    { icon: 'link', title: 'Links that look like you', body: 'Pick your own alias or let Zelqit generate a tidy 7-character code. Change the destination later without reprinting anything.' },
    { icon: 'chart', title: 'Analytics you can trust', body: 'Clicks, unique visitors, sources, browsers and devices — with bots filtered out so the numbers mean something.' },
    { icon: 'qr', title: 'QR codes built in', body: 'Every link has a QR code ready to download as a PNG for posters, packaging and slides.' },
    { icon: 'lock', title: 'Passwords & expiry', body: 'Protect a link with a password, or let it switch itself off when a campaign ends.' },
    { icon: 'zap', title: 'A/B destination splits', body: 'Send one link to several pages by weight and compare which one people actually choose.' },
    { icon: 'sparkles', title: 'Your link-in-bio page', body: 'One public page that lists your best links — every tap is tracked like any other click.' },
  ];

  readonly steps = [
    { title: 'Paste a long link', body: 'Add an alias, an expiry date or a password if you need one.' },
    { title: 'Share it anywhere', body: 'Social posts, emails, print, a QR code on a poster — it all goes through one short link.' },
    { title: 'See who clicked', body: 'Watch clicks, unique visitors and sources build up day by day.' },
  ];

  // Illustrative only — the section is labelled "Sample data".
  readonly sampleBars = [32, 41, 38, 55, 49, 68, 74, 61, 83, 79, 92, 88, 97, 110];
  readonly sampleSources = [
    { label: 'Instagram', share: 38 },
    { label: 'Direct', share: 27 },
    { label: 'Email', share: 19 },
    { label: 'Google', share: 16 },
  ];

  readonly security: Feature[] = [
    { icon: 'lock', title: 'Password-protected links', body: 'Visitors need the password before they reach the destination. Repeated wrong guesses are slowed down.' },
    { icon: 'shield', title: 'Bot filtering', body: 'Crawlers and link-preview bots are detected and kept out of your numbers unless you choose to include them.' },
    { icon: 'globe', title: 'Privacy-first counting', body: 'Unique visitors come from a salted one-way hash. Raw IP addresses are never stored.' },
  ];

  readonly faqs = [
    { q: 'Is there a free plan?', a: 'Yes. The Free plan includes 25 new links every month and 30 days of analytics. No card needed.' },
    { q: 'What does Pro add?', a: `Unlimited links, your full analytics history, country and city stats, folders and tags, UTM presets, A/B splits and a link-in-bio page — ${formatInr(PRICES.monthly)} a month or ${formatInr(PRICES.yearly)} a year.` },
    { q: 'How are unique visitors counted?', a: 'Each click is matched by a salted, one-way hash of the network address and browser. It is private by design, so people on the same network with the same browser may count once.' },
    { q: 'Do my links stop working if I cancel Pro?', a: 'No. Pro stays active until the end of the period you paid for, and your links keep redirecting afterwards. Pro-only settings become read-only.' },
    { q: 'Can I change where a link points?', a: 'Yes — edit the destination at any time and the short link, its QR code and its history stay the same.' },
  ];

  constructor(private router: Router) {}

  /** Guests can't shorten here: carry the URL into sign-up instead. */
  startWithUrl(): void {
    const url = this.demoUrl.trim();
    this.router.navigate(['/signup'], url ? { queryParams: { url } } : {});
  }

  barHeight(value: number): number {
    return Math.round((value / Math.max(...this.sampleBars)) * 100);
  }
}
