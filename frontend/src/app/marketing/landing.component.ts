import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import type { IconName } from '../ui/icon.component';
import { PRICES, formatInr } from './plans';

/** Runs `task` when the browser is idle (at most ~3 s later). Returns a cancel function. */
function whenIdle(task: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(task, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(task, 1500);
  return () => clearTimeout(id);
}

/**
 * Runs `task` once the page's first contentful paint is on screen and the browser is idle. Idle alone isn't enough:
 * it can come before that frame is presented, and WebGL start-up would then delay it. Returns a cancel function.
 */
function afterFirstPaint(task: () => void): () => void {
  let cancel: () => void;
  if (!PerformanceObserver.supportedEntryTypes?.includes('paint')) {
    const id = requestAnimationFrame(() => (cancel = whenIdle(task))); // runs once rendering has started
    cancel = () => cancelAnimationFrame(id);
  } else {
    const observer = new PerformanceObserver((entries) => {
      if (!entries.getEntriesByName('first-contentful-paint').length) return;
      observer.disconnect();
      cancel = whenIdle(task);
    });
    observer.observe({ type: 'paint', buffered: true }); // buffered: already painted (in-app navigation) fires at once
    cancel = () => observer.disconnect();
  }
  return () => cancel();
}

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
  private cancelStart?: () => void;
  private stopPalette?: () => void;
  private destroyed = false;
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
  readonly sampleBars = [34, 48, 42, 63, 71, 88, 104];
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
   * The 3D experience (three.js + GSAP + Lenis) is its own chunk, loaded after first paint so it never competes
   * with it. It runs outside Angular, so its frame loop and listeners never trigger change detection.
   */
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.stopPalette = this.followSectionPalette();
      this.cancelStart = afterFirstPaint(() => {
        import('../experience/landing')
          .then(({ startLanding }) => (this.destroyed ? null : startLanding(this.host.nativeElement)))
          .then((stop) => {
            if (!stop) return;
            if (this.destroyed) return stop(); // left the page while it was starting
            this.stopExperience = stop;
          })
          .catch((error) => console.warn('3D experience unavailable; keeping the static hero.', error));
      });
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelStart?.();
    this.stopExperience?.();
    this.stopPalette?.();
  }

  /**
   * The header, footer and page background take the palette of the section in the middle of the screen
   * (`data-palette` on <html>). In live 3D mode the sections hand their palettes to <html> as well, so everything
   * on screen shares it (src/app/experience/landing.ts). Sections without a palette (the CTA) keep the last one.
   */
  private followSectionPalette(): () => void {
    const root = document.documentElement;
    const sections = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('section'));
    const update = () => {
      const middle = window.innerHeight / 2;
      const section = sections.find((s) => {
        const box = s.getBoundingClientRect();
        return box.top <= middle && box.bottom > middle;
      });
      const palette = section?.dataset['palette'] ?? section?.dataset['xpPalette'];
      if (palette && root.dataset['palette'] !== palette) root.dataset['palette'] = palette;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      delete root.dataset['palette'];
    };
  }

  /** Guests can't shorten here: carry the URL into sign-up instead. */
  startWithUrl(): void {
    const url = this.demoUrl.trim();
    this.router.navigate(['/signup'], url ? { queryParams: { url } } : {});
  }
}
