import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { ThemeService } from '../ui/theme.service';
import type { DayCount } from '../api-types';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const token = (name: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()})`;

/** Clicks-per-day bar chart. Colours follow the theme tokens and update when the theme changes. */
@Component({
  selector: 'app-clicks-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block h-64' },
  template: `<canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>`,
})
export class ClicksChartComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  @Input() days: DayCount[] = [];

  private chart?: Chart;
  private themeChanges?: Subscription;

  constructor(private theme: ThemeService) {}

  ngOnInit(): void {
    this.themeChanges = this.theme.preference$.subscribe(() => this.draw());
  }

  ngOnChanges(): void {
    this.draw();
  }

  ngOnDestroy(): void {
    this.themeChanges?.unsubscribe();
    this.chart?.destroy();
  }

  ariaLabel(): string {
    const total = this.days.reduce((sum, d) => sum + d.count, 0);
    return `Bar chart: ${total} clicks over ${this.days.length} days`;
  }

  private draw(): void {
    if (!this.canvas) return;
    this.chart?.destroy();
    const muted = token('muted');
    const line = token('line');
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: {
        labels: this.days.map((d) => d.date.slice(5)), // MM-DD
        datasets: [{ label: 'Clicks', data: this.days.map((d) => d.count), backgroundColor: token('brand-glow'), borderRadius: 4, maxBarThickness: 28 }],
      },
      options: {
        maintainAspectRatio: false,
        animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
        scales: {
          x: { grid: { display: false }, ticks: { color: muted, maxTicksLimit: 10 } },
          y: { beginAtZero: true, grid: { color: line }, ticks: { color: muted, precision: 0 } },
        },
      },
    });
  }
}
