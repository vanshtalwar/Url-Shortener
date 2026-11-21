import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { LinkStats, LinksService, shortUrl } from '../../links.service';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

@Component({
  selector: 'app-link-detail',
  templateUrl: './link-detail.component.html',
})
export class LinkDetailComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  stats: LinkStats | null = null;
  includeBots = false;
  error = '';
  shortUrl = shortUrl;

  private id = '';
  private chart?: Chart;

  constructor(private route: ActivatedRoute, private linksService: LinksService) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  load(): void {
    this.error = '';
    this.linksService.stats(this.id, this.includeBots).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.drawChart(stats);
      },
      error: (err) => (this.error = err.status === 404 ? 'Link not found.' : 'Could not load stats.'),
    });
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
        datasets: [{ label: 'Clicks', data: stats.clicksPerDay.map((d) => d.count), backgroundColor: '#2f6fed' }],
      },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }
}
