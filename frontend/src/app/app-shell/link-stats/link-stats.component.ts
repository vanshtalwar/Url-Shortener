import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { LinkStats, LinksService, shortUrl } from '../../links.service';
import { MeService } from '../../me.service';
import { ToastService } from '../../ui/toast.service';
import { UpgradePromptService } from '../../upgrade-prompt.service';
import { cityLabel, countryName } from './countries';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; stats: LinkStats };

/** Analytics for one link. switchMap drops stale responses when the bot toggle changes; async pipe cancels on leave. */
@Component({
  selector: 'app-link-stats',
  templateUrl: './link-stats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkStatsComponent {
  readonly includeBots$ = new BehaviorSubject(false);
  private readonly retry$ = new BehaviorSubject<void>(undefined);
  readonly state$ = combineLatest([this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), this.includeBots$, this.retry$]).pipe(
    switchMap(([id, bots]) =>
      this.links.stats(id, bots).pipe(
        map((stats): State => ({ status: 'ready', stats })),
        catchError((err) => of<State>({ status: err.status === 404 ? 'missing' : 'error' })),
        startWith<State>({ status: 'loading' }),
      ),
    ),
  );

  readonly shortUrl = shortUrl;
  readonly countryName = countryName;
  readonly cityLabel = cityLabel;

  constructor(
    private route: ActivatedRoute,
    private links: LinksService,
    public me: MeService,
    private toast: ToastService,
    private upgrade: UpgradePromptService,
  ) {}

  retry(): void {
    this.retry$.next();
  }

  copy(code: string): void {
    navigator.clipboard.writeText(shortUrl(code)).then(
      () => this.toast.show('Short link copied'),
      () => this.toast.show('Could not copy — select the link and copy it manually'),
    );
  }

  askUpgrade(reason: string): void {
    this.upgrade.open(reason);
  }

  variantShare(clicks: number, variants: { clicks: number }[]): number {
    const total = variants.reduce((sum, v) => sum + v.clicks, 0);
    return total > 0 ? Math.round((clicks / total) * 100) : 0;
  }
}
