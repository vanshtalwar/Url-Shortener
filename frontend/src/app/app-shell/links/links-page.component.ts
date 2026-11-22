import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subject, catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, takeUntil } from 'rxjs';
import { Folder, Link, LinkFilters, LinksService, isExpired, shortUrl } from '../../links.service';
import { MeService } from '../../me.service';
import { ToastService } from '../../ui/toast.service';
import { takePendingUrl } from '../../pending-url';
import { apiError } from '../../api-error';

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; links: Link[] };

@Component({
  selector: 'app-links-page',
  templateUrl: './links-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinksPageComponent implements OnInit, OnDestroy {
  readonly filters$ = new BehaviorSubject<LinkFilters>({});
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  private readonly search$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly state$ = combineLatest([this.filters$, this.reload$]).pipe(
    switchMap(([filters]) =>
      this.links.list(filters).pipe(
        map((links): ListState => ({ status: 'ready', links })),
        catchError(() => of<ListState>({ status: 'error' })),
        startWith<ListState>({ status: 'loading' }),
      ),
    ),
  );
  readonly folders$ = this.reload$.pipe(
    switchMap(() => this.links.folders().pipe(catchError(() => of<Folder[]>([])))),
  );

  editing: { link: Link | null; initialUrl: string } | null = null;
  qrCode: string | null = null;
  deleting: Link | null = null;
  deleteError = '';
  managingFolders = false;
  search = '';
  now = Date.now();

  readonly shortUrl = shortUrl;
  readonly isExpired = isExpired;

  constructor(private links: LinksService, public me: MeService, private toast: ToastService) {}

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((q) => this.setFilter({ q: q.trim() || undefined }));
    const pending = takePendingUrl(); // typed on the landing page before signing up
    if (pending) this.editing = { link: null, initialUrl: pending };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasFilters(): boolean {
    const f = this.filters$.value;
    return Boolean(f.q || f.folder || f.tag);
  }

  onSearch(value: string): void {
    this.search$.next(value);
  }

  setFilter(change: Partial<LinkFilters>): void {
    this.filters$.next({ ...this.filters$.value, ...change });
  }

  clearFilters(): void {
    this.search = '';
    this.filters$.next({});
  }

  folderName(folders: Folder[], id: string | null): string | null {
    return id ? folders.find((f) => f.id === id)?.name ?? null : null;
  }

  trackById(_: number, link: Link): string {
    return link.id;
  }

  copy(link: Link): void {
    navigator.clipboard.writeText(shortUrl(link.code)).then(
      () => this.toast.show('Short link copied'),
      () => this.toast.show('Could not copy — select the link and copy it manually'),
    );
  }

  onSaved(link: Link, created: boolean): void {
    this.editing = null;
    this.toast.show(created ? `Created ${shortUrl(link.code)}` : 'Changes saved');
    this.refresh();
  }

  confirmDelete(): void {
    const link = this.deleting;
    if (!link) return;
    this.deleteError = '';
    this.links.remove(link.id).subscribe({
      next: () => {
        this.deleting = null;
        this.toast.show('Link deleted');
        this.refresh();
      },
      error: (err) => (this.deleteError = apiError(err).message),
    });
  }

  refresh(): void {
    this.now = Date.now();
    this.reload$.next();
    this.me.refresh(); // monthly usage changed
  }
}
