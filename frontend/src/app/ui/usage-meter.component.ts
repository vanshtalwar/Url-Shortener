import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** "12 / 25 links this month" with a bar that turns warning-coloured near the limit. */
@Component({
  selector: 'z-usage-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-baseline justify-between text-xs">
      <span class="text-muted">{{ label }}</span>
      <span class="font-medium tabular-nums">{{ used }} / {{ limit }}</span>
    </div>
    <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" [attr.aria-valuenow]="used" aria-valuemin="0"
         [attr.aria-valuemax]="limit" [attr.aria-label]="label">
      <div class="h-full rounded-full transition-all" [class.bg-brand]="ratio < 0.8" [class.bg-warning]="ratio >= 0.8" [style.width.%]="ratio * 100"></div>
    </div>
  `,
})
export class UsageMeterComponent {
  @Input() label = '';
  @Input() used = 0;
  @Input() limit = 1;

  get ratio(): number {
    return Math.min(this.used / Math.max(this.limit, 1), 1);
  }
}
