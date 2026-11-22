import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type StandIn = 'hero' | 'qr' | 'bars' | 'globe' | 'split' | 'lock' | 'pricing' | 'cta';

/**
 * A flat SVG of one 3D moment, shown in its `data-xp-anchor` box until the 3D experience draws there (and for good
 * without WebGL). Colours come from the section palette (`--tint`). Decorative: the anchor is aria-hidden.
 */
@Component({
  selector: 'app-stand-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full w-full' },
  // *ngIf, not ngSwitch: ngSwitch isn't used elsewhere, so it would add ~1 kB to the initial bundle.
  template: `
    <svg *ngIf="moment === 'hero'" viewBox="0 0 320 120" class="h-full w-full">
      <defs>
        <linearGradient id="stand-in-chain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color: rgb(var(--brand-glow))" />
          <stop offset="1" style="stop-color: rgb(var(--brand-to))" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#stand-in-chain)" stroke-width="9" stroke-linecap="round">
        <rect x="20" y="40" width="90" height="40" rx="20" />
        <rect x="90" y="48" width="70" height="24" rx="12" opacity="0.7" />
        <rect x="140" y="40" width="90" height="40" rx="20" />
        <rect x="210" y="48" width="70" height="24" rx="12" opacity="0.7" />
      </g>
    </svg>
    <svg *ngIf="moment === 'qr'" viewBox="0 0 90 90" class="h-full w-full fill-tint">
      <path d="M4 4h22v22H4zM9 9v12h12V9zM64 4h22v22H64zM69 9v12h12V9zM4 64h22v22H4zM9 69v12h12V69z" fill-rule="evenodd" />
      <path d="M12 12h6v6h-6zM72 12h6v6h-6zM12 72h6v6h-6zM32 4h6v6h-6zM44 10h6v6h-6zM32 20h12v6H32zM50 28h6v12h-6zM4 32h12v6H4zM22 38h12v6H22zM38 38h6v6h-6zM62 32h6v6h-6zM74 38h12v6H74zM32 50h6v12h-6zM44 56h18v6H44zM68 50h6v6h-6zM80 56h6v12h-6zM50 68h6v6h-6zM38 74h6v12h-6zM56 80h12v6H56zM68 68h6v6h-6z" />
    </svg>
    <svg *ngIf="moment === 'bars'" viewBox="0 0 160 120" class="h-full w-full fill-tint">
      <rect *ngFor="let bar of bars; let i = index" [attr.x]="6 + i * 22" [attr.y]="114 - bar" width="16" [attr.height]="bar" rx="3" [attr.opacity]="0.45 + i * 0.08" />
    </svg>
    <svg *ngIf="moment === 'globe'" viewBox="0 0 120 120" class="h-full w-full fill-none stroke-tint" stroke-width="1.5">
      <circle cx="60" cy="60" r="48" opacity="0.9" />
      <ellipse cx="60" cy="60" rx="20" ry="48" opacity="0.5" />
      <ellipse cx="60" cy="60" rx="38" ry="48" opacity="0.35" />
      <path d="M14 46h92M14 74h92" opacity="0.4" />
      <path d="M36 70Q60 20 86 44" stroke-width="2" stroke-dasharray="3 3" />
      <path d="M30 50Q58 96 82 76" stroke-width="2" stroke-dasharray="3 3" />
      <circle cx="86" cy="44" r="3" class="fill-tint" /><circle cx="82" cy="76" r="3" class="fill-tint" />
    </svg>
    <svg *ngIf="moment === 'split'" viewBox="0 0 160 120" class="h-full w-full fill-none stroke-tint" stroke-linecap="round">
      <rect x="8" y="48" width="40" height="24" rx="12" stroke-width="6" />
      <path d="M48 60C88 60 92 28 136 28" stroke-width="7" />
      <path d="M48 60C88 60 92 92 136 92" stroke-width="4" />
      <circle cx="142" cy="28" r="7" class="fill-tint" /><circle cx="142" cy="92" r="7" class="fill-tint" />
    </svg>
    <svg *ngIf="moment === 'lock'" viewBox="0 0 120 120" class="h-full w-full fill-none stroke-tint" stroke-width="8" stroke-linecap="round">
      <path d="M38 54V40a22 22 0 0 1 44 0v14" />
      <rect x="26" y="54" width="68" height="54" rx="12" class="fill-tint" stroke="none" opacity="0.9" />
      <circle cx="60" cy="78" r="6" class="fill-canvas" stroke="none" /><path d="M60 82v10" class="stroke-canvas" stroke-width="6" />
    </svg>
    <svg *ngIf="moment === 'pricing'" viewBox="0 0 160 60" class="h-full w-full fill-none stroke-tint" stroke-width="8" stroke-linecap="round">
      <rect x="12" y="16" width="76" height="28" rx="14" /><rect x="72" y="16" width="76" height="28" rx="14" />
    </svg>
    <svg *ngIf="moment === 'cta'" viewBox="0 0 24 24" class="h-full w-full" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" />
    </svg>
  `,
})
export class StandInComponent {
  @Input() moment!: StandIn;
  readonly bars = [34, 48, 42, 63, 71, 88, 104]; // same shape as the 3D bar chart's sample values
}
