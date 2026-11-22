import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, catchError, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { LinkStats, LinksService, shortUrl } from '../../links.service';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

/** Bar colour follows the app's --accent CSS variable. */
function accentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
}

@Component({
  selector: 'app-link-detail',
  templateUrl: './link-detail.component.html',
})
export class LinkDetailComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  stats: LinkStats | null = null;
  includeBots = false;
  error = '';
  readonly shortUrl = shortUrl;

  private chart?: Chart;
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private linksService: LinksService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => (this.error = '')),
        // switchMap drops an older, slower response when the bot toggle changes again.
        switchMap(() =>
          this.linksService.stats(id, this.includeBots).pipe(
            catchError((err) => {
              this.error = err.status === 404 ? 'Link not found.' : 'Could not load stats.';
              return EMPTY;
            }),
          ),
        ),
        // Cancels an in-flight request when the page is left, so no chart is drawn afterwards.
        takeUntil(this.destroy$),
      )
      .subscribe((stats) => {
        this.stats = stats;
        this.drawChart(stats);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chart?.destroy();
  }

  reload(): void {
    this.reload$.next();
  }

  percent(count: number): number {
    return this.stats && this.stats.total > 0 ? Math.round((count / this.stats.total) * 100) : 0;
  }

  private drawChart(stats: LinkStats): void {
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: {
        labels: stats.clicksPerDay.map((d) => d.date),
        datasets: [{ label: 'Clicks', data: stats.clicksPerDay.map((d) => d.count), backgroundColor: accentColor() }],
      },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }
}
