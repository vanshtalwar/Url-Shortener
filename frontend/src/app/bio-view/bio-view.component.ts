import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { BioTheme } from '../api-types';

interface Look {
  page: string;
  button: string;
  muted: string;
  avatar: string;
}

// The owner picks the theme, so these don't follow the app's light/dark tokens.
const LOOKS: Record<BioTheme, Look> = {
  violet: { page: 'bg-gradient-to-br from-[#7c3aed] to-[#3730a3] text-white', button: 'border-white/25 bg-white/10 hover:bg-white/20 text-white', muted: 'text-white/80', avatar: 'border-white/30 bg-white/10' },
  midnight: { page: 'bg-[#07060b] text-[#f4f3ff]', button: 'border-[#27233a] bg-[#15121f] hover:bg-[#1d1930] text-[#f4f3ff]', muted: 'text-[#a19fb8]', avatar: 'border-[#27233a] bg-[#15121f]' },
  light: { page: 'bg-[#fafafe] text-[#14121f]', button: 'border-[#e6e4f2] bg-white hover:bg-[#f3f2fb] text-[#14121f]', muted: 'text-[#5e5a73]', avatar: 'border-[#e6e4f2] bg-white' },
};

/** A link-in-bio page. Used by the public /@handle page and the editor's live preview. */
@Component({
  selector: 'app-bio-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex min-h-full flex-col items-center px-5 py-12" [ngClass]="look.page">
      <div class="flex h-16 w-16 items-center justify-center rounded-full border-2 font-display text-2xl font-bold" [ngClass]="look.avatar" aria-hidden="true">
        {{ initial }}
      </div>
      <h1 class="mt-4 text-center font-display text-2xl font-bold">{{ title || 'Your title' }}</h1>
      <p *ngIf="description" class="mt-2 max-w-sm text-center text-sm" [ngClass]="look.muted">{{ description }}</p>
      <ul class="mt-8 w-full max-w-sm space-y-3">
        <li *ngFor="let link of links">
          <a [attr.href]="link.href" target="_blank" rel="noopener"
             class="block rounded-2xl border px-5 py-3.5 text-center text-sm font-semibold transition-colors" [ngClass]="look.button">{{ link.label }}</a>
        </li>
        <li *ngIf="links.length === 0" class="text-center text-sm" [ngClass]="look.muted">No links yet.</li>
      </ul>
      <a href="/" class="mt-auto pt-12 text-xs opacity-70 hover:opacity-100">Made with Zelqit</a>
    </div>
  `,
})
export class BioViewComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() theme: BioTheme = 'violet';
  /** href is null in the editor preview, so preview taps don't count as clicks. */
  @Input() links: { label: string; href: string | null }[] = [];

  get look(): Look {
    return LOOKS[this.theme];
  }

  get initial(): string {
    return (this.title.trim()[0] ?? 'Z').toUpperCase();
  }
}
