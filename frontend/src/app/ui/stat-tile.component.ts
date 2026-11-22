import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** One headline number with a label, e.g. "Clicks · 1,248". */
@Component({
  selector: 'z-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block rounded-2xl border border-line bg-surface p-5 shadow-soft' },
  template: `
    <p class="text-sm text-muted">{{ label }}</p>
    <p class="mt-1 font-display text-3xl font-bold tabular-nums">{{ value ?? '—' }}</p>
    <p *ngIf="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>
  `,
})
export class StatTileComponent {
  @Input() label = '';
  @Input() value: string | number | null = ''; // null (e.g. from the number pipe) shows a dash
  @Input() hint?: string;
}
