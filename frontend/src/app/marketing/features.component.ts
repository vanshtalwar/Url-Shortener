import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';
import type { IconName } from '../ui/icon.component';
import { followSectionPalette, startAfterFirstPaint } from '../experience-loader';

export interface FeatureGroup {
  id: string; // its heading's id is `${id}-title`
  icon: IconName;
  title: string;
  pro: boolean;
  points: string[];
}

/** A feature group's copy: plan badge, heading (id `${group.id}-title`, for its section's label), points. */
@Component({
  selector: 'app-feature-copy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-badge [tone]="group.pro ? 'pro' : 'neutral'">{{ group.pro ? 'Pro' : 'All plans' }}</z-badge>
    <h2 [id]="group.id + '-title'" class="xp-headline mt-4 text-4xl sm:text-5xl lg:text-6xl">{{ group.title }}</h2>
    <ul class="mt-6 space-y-3 text-lg text-muted">
      <li *ngFor="let point of group.points" class="flex gap-3"><z-icon name="check" class="mt-1 shrink-0 text-accent"></z-icon>{{ point }}</li>
    </ul>
  `,
})
export class FeatureCopyComponent {
  @Input() group!: FeatureGroup;
}

/** Each feature group in its own section, in the order of the 3D journey's moments (see the template). */
@Component({
  selector: 'app-features',
  templateUrl: './features.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesComponent implements AfterViewInit, OnDestroy {
  readonly groups: Record<'links' | 'qr' | 'analytics' | 'countries' | 'split' | 'password' | 'folders' | 'bio', FeatureGroup> = {
    links: { id: 'links', icon: 'link', title: 'Short links', pro: false, points: ['Random 7-character codes or your own alias', 'Change the destination any time', 'Optional expiry date — the link switches off on its own', 'Copy or open with one click'] },
    qr: { id: 'qr', icon: 'qr', title: 'QR codes', pro: false, points: ['A QR code for every link', 'Download as PNG for print and slides', 'Scans are counted like any other click'] },
    analytics: { id: 'analytics', icon: 'chart', title: 'Click analytics', pro: false, points: ['Clicks and unique visitors per day', 'Top referring sites, browsers, operating systems and devices', 'Bots detected and shown separately', 'Free: last 30 days · Pro: full history'] },
    countries: { id: 'countries', icon: 'globe', title: 'Country & city analytics', pro: true, points: ['Where your visitors are, by country and city', 'Approximate location from an on-server lookup', 'No raw IP addresses stored'] },
    split: { id: 'split', icon: 'zap', title: 'A/B destination splits', pro: true, points: ['Send one link to 2–5 destinations by weight', 'See clicks for each destination', 'Change weights without losing history'] },
    password: { id: 'password', icon: 'lock', title: 'Password-protected links', pro: false, points: ['Visitors enter a password before the redirect', 'Repeated wrong guesses are slowed down', 'Change or remove the password later'] },
    folders: { id: 'folders', icon: 'folder', title: 'Folders, tags & UTM presets', pro: true, points: ['Group links into folders and tag them', 'Filter and search your links', 'Build UTM-tagged URLs and save presets'] },
    bio: { id: 'bio', icon: 'sparkles', title: 'Link-in-bio page', pro: true, points: ['One public page at /@your-name', 'Pick the links and labels to show', 'Every tap is tracked through your short links'] },
  };
  /** The Pro groups without a 3D moment of their own. */
  readonly proExtras = [this.groups.folders, this.groups.bio];

  private stopExperience?: () => void;
  private stopPalette?: () => void;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  /** Colours follow the section in view; the 3D journey (its own chunk) starts after first paint, with short pins. */
  ngAfterViewInit(): void {
    const page = this.host.nativeElement;
    this.stopPalette = followSectionPalette(this.zone, page);
    this.stopExperience = startAfterFirstPaint(this.zone, () => import('../experience/journey-page'), ({ startJourney }) =>
      startJourney(page, { share: '70%', know: '60%', test: '60%', protect: '60%' }),
    );
  }

  ngOnDestroy(): void {
    this.stopExperience?.();
    this.stopPalette?.();
  }
}
