import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface Item {
  value: string;
  count: number;
}

const DEFAULT_ROWS = 8;

/** A titled list of values with counts and share bars (referrers, browsers, countries…). */
@Component({
  selector: 'app-breakdown-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-card class="!p-5">
      <h3 class="text-base font-semibold">{{ title }}</h3>
      <p *ngIf="items.length === 0" class="mt-3 text-sm text-muted">No data yet.</p>
      <ul class="mt-3 space-y-2.5">
        <li *ngFor="let item of shown" class="text-sm">
          <div class="flex items-baseline justify-between gap-3">
            <span class="min-w-0 truncate" [title]="labelOf(item.value)">{{ labelOf(item.value) }}</span>
            <span class="shrink-0 tabular-nums text-muted">{{ item.count | number }} · {{ share(item.count) }}%</span>
          </div>
          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div class="h-full rounded-full bg-brand" [style.width.%]="share(item.count)"></div>
          </div>
        </li>
      </ul>
      <button *ngIf="items.length > rows" type="button" class="mt-3 text-xs font-medium text-accent hover:underline" (click)="expanded = !expanded">
        {{ expanded ? 'Show less' : 'Show all ' + items.length }}
      </button>
    </z-card>
  `,
})
export class BreakdownCardComponent {
  @Input() title = '';
  @Input() items: Item[] = [];
  @Input() total = 0;
  @Input() rows = DEFAULT_ROWS;
  /** Optional display mapping, e.g. country code → name. */
  @Input() label: (value: string) => string = (v) => v;
  expanded = false;

  get shown(): Item[] {
    return this.expanded ? this.items : this.items.slice(0, this.rows);
  }

  labelOf(value: string): string {
    return this.label(value);
  }

  share(count: number): number {
    return this.total > 0 ? Math.round((count / this.total) * 100) : 0;
  }
}
