import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, startWith, switchMap, tap } from 'rxjs';
import { BioService } from '../bio.service';
import type { PublicBio } from '../api-types';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; bio: PublicBio };

/** Public /@handle page. Works logged out; every tap goes through a tracked short link. */
@Component({
  selector: 'app-public-bio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-screen' },
  template: `
    <ng-container *ngIf="state$ | async as state">
      <div *ngIf="state.status === 'loading'" class="flex min-h-screen items-center justify-center" aria-busy="true">
        <z-icon name="loader" [size]="28" class="animate-spin text-muted"></z-icon>
      </div>
      <main *ngIf="state.status === 'missing'" class="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 class="text-2xl font-bold">This page doesn't exist</h1>
        <p class="mt-2 text-sm text-muted">Check the address, or make your own.</p>
        <a zButton routerLink="/" class="mt-6">Go to Zelqit</a>
      </main>
      <main *ngIf="state.status === 'ready'" class="min-h-screen">
        <app-bio-view class="min-h-screen" [title]="state.bio.title" [description]="state.bio.description" [theme]="state.bio.theme"
                      [links]="hrefs(state.bio)"></app-bio-view>
      </main>
    </ng-container>
  `,
})
export class PublicBioComponent {
  readonly state$ = this.route.paramMap.pipe(
    map((p) => p.get('handle') ?? ''),
    switchMap((handle) =>
      this.bio.publicPage(handle).pipe(
        tap((bio) => this.title.setTitle(`${bio.title} · Zelqit`)),
        map((bio): State => ({ status: 'ready', bio })),
        catchError(() => {
          this.title.setTitle('Page not found · Zelqit');
          return of<State>({ status: 'missing' });
        }),
        startWith<State>({ status: 'loading' }),
      ),
    ),
  );

  constructor(private route: ActivatedRoute, private bio: BioService, private title: Title) {}

  hrefs(bio: PublicBio): { label: string; href: string }[] {
    return bio.links.map((l) => ({ label: l.label, href: l.shortUrl }));
  }
}
