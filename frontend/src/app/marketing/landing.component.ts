import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import type { IconName } from '../ui/icon.component';
import { followSectionPalette, startAfterFirstPaint } from '../experience-loader';
import { startCursor } from './cursor';
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
export class LandingComponent implements AfterViewInit, OnDestroy {
  demoUrl = '';
  private stopExperience?: () => void;
  private stopPalette?: () => void;
  private stopCursor?: () => void;
  readonly proMonthly = formatInr(PRICES.monthly);

  readonly strip = [
    'Custom aliases', 'QR codes', 'Password-protected links', 'Link expiry', 'A/B destination splits',
    'UTM builder', 'Folders & tags', 'Link-in-bio', 'Bot filtering', 'Country & city stats',
  ];

  // Copy for each moment of the journey (the old feature grid, "How it works" and security sections, folded in).
  readonly shareItems: Feature[] = [
    { icon: 'plus', title: 'Paste a long link', body: 'Add an alias, an expiry date or a password if you need one.' },
    { icon: 'link', title: 'Links that look like you', body: 'Pick your own alias or let Zelqit generate a tidy 7-character code. Change the destination later without reprinting anything.' },
    { icon: 'qr', title: 'QR codes built in', body: 'Every link has a QR code ready to download as a PNG for posters, packaging and slides.' },
    { icon: 'sparkles', title: 'Your link-in-bio page', body: 'One public page that lists your best links — every tap is tracked like any other click.' },
  ];

  readonly knowPoints = ['Clicks and unique visitors for every day', 'Where people came from, and on which device', 'Bots counted separately, never mixed in'];

  // Illustrative only — labelled "Sample data" / "Sample split" on the page.
  readonly sampleStats = [
    { label: 'Clicks', count: 1248 },
    { label: 'Unique', count: 903 },
    { label: 'Bots', count: 57 },
  ];
  readonly sampleSplit = [
    { weight: 60, url: 'example.com/landing-a' },
    { weight: 40, url: 'example.com/landing-b' },
  ];

  readonly protectItems: Feature[] = [
    { icon: 'lock', title: 'Password-protected links', body: 'Visitors need the password before they reach the destination. Repeated wrong guesses are slowed down.' },
    { icon: 'zap', title: 'Links that expire', body: 'Let a link switch itself off when a campaign ends.' },
    { icon: 'shield', title: 'Bot filtering', body: 'Crawlers and link-preview bots are detected and kept out of your numbers unless you choose to include them.' },
  ];

  readonly faqs = [
    { q: 'Is there a free plan?', a: 'Yes. The Free plan includes 25 new links every month and 30 days of analytics. No card needed.' },
    { q: 'What does Pro add?', a: `Unlimited links, your full analytics history, country and city stats, folders and tags, UTM presets, A/B splits and a link-in-bio page — ${formatInr(PRICES.monthly)} a month or ${formatInr(PRICES.yearly)} a year.` },
    { q: 'How are unique visitors counted?', a: 'Each click is matched by a salted, one-way hash of the network address and browser. It is private by design, so people on the same network with the same browser may count once.' },
    { q: 'Do my links stop working if I cancel Pro?', a: 'No. Pro stays active until the end of the period you paid for, and your links keep redirecting afterwards. Pro-only settings become read-only.' },
    { q: 'Can I change where a link points?', a: 'Yes — edit the destination at any time and the short link, its QR code and its history stay the same.' },
  ];

  constructor(private router: Router, private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  /**
   * Colours follow the section in view; the 3D journey (its own chunk) starts after first paint; with a mouse, the
   * cursor becomes a dot in a jiggly ring (./cursor).
   */
  ngAfterViewInit(): void {
    const page = this.host.nativeElement;
    this.stopPalette = followSectionPalette(this.zone, page);
    this.stopCursor = this.zone.runOutsideAngular(() => startCursor());
    this.stopExperience = startAfterFirstPaint(this.zone, () => import('../experience/journey-page'), ({ startJourney }) =>
      startJourney(page, { share: '120%', know: '100%', test: '100%', protect: '100%' }),
    );
  }

  ngOnDestroy(): void {
    this.stopExperience?.();
    this.stopPalette?.();
    this.stopCursor?.();
  }

  /** Guests can't shorten here: carry the URL into sign-up instead. */
  startWithUrl(): void {
    const url = this.demoUrl.trim();
    this.router.navigate(['/signup'], url ? { queryParams: { url } } : {});
  }
}
