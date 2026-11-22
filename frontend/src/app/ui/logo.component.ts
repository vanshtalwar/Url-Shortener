import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Zelqit logo: gradient tile with a "Z" whose top and bottom bars are chain links, plus the wordmark.
 * `mono` uses currentColor (for single-colour contexts); `iconOnly` drops the wordmark.
 */
@Component({
  selector: 'z-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="rgb(var(--brand-from))" />
          <stop offset="1" stop-color="rgb(var(--brand-to))" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" [attr.fill]="mono ? 'currentColor' : 'url(#' + gradientId + ')'" />
      <g fill="none" [attr.stroke]="mono ? 'rgb(var(--canvas))' : '#fff'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="8" y="7.5" width="16" height="5" rx="2.5" />
        <path d="M21.5 12.5 10.5 19.5" />
        <rect x="8" y="19.5" width="16" height="5" rx="2.5" />
      </g>
    </svg>
    <span *ngIf="!iconOnly" class="font-display text-lg font-bold tracking-tight">Zelqit</span>
    <span *ngIf="iconOnly" class="sr-only">Zelqit</span>
  `,
})
export class LogoComponent {
  @Input() size = 28;
  @Input() mono = false;
  @Input() iconOnly = false;
  // Unique per instance so several logos on a page don't share one gradient definition.
  readonly gradientId = `zelqit-logo-${Math.random().toString(36).slice(2, 8)}`;
}
