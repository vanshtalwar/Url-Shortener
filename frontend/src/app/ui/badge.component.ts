import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

type Tone = 'neutral' | 'pro' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'border border-line bg-surface-2 text-muted',
  pro: 'bg-brand text-white',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

/** Small pill label. `tone="pro"` is the Pro badge (adds a lock icon when `locked`). */
@Component({
  selector: 'z-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<z-icon *ngIf="locked" name="lock" [size]="12"></z-icon><ng-content></ng-content>`,
})
export class BadgeComponent {
  @Input() tone: Tone = 'neutral';
  @Input() locked = false;

  @HostBinding('class') get classes(): string {
    return `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[this.tone]}`;
  }
}
