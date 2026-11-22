import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Overview } from '../api-types';
import { MeService } from '../me.service';
import { UpgradePromptService } from '../upgrade-prompt.service';

type Range = 7 | 30 | 90;
type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Overview };

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewComponent {
  readonly ranges: Range[] = [7, 30, 90];
  readonly range$ = new BehaviorSubject<Range>(30);
  readonly state$ = this.range$.pipe(
    switchMap((days) =>
      this.http.get<Overview>(`${environment.apiUrl}/api/stats/overview`, { params: { days } }).pipe(
        map((data): State => ({ status: 'ready', data })),
        catchError(() => of<State>({ status: 'error' })),
        startWith<State>({ status: 'loading' }),
      ),
    ),
  );

  constructor(private http: HttpClient, public me: MeService, private upgrade: UpgradePromptService) {}

  /** Ranges beyond the Free history open the upgrade dialog instead. */
  select(days: Range, historyDays: number | null): void {
    if (historyDays !== null && days > historyDays) {
      this.upgrade.open(`Free shows the last ${historyDays} days. Pro keeps your full history.`);
      return;
    }
    this.range$.next(days);
  }
}
