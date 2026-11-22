import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BlogService } from './blog.service';

@Component({
  selector: 'app-blog-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-16 lg:py-24">
      <h1 class="text-4xl font-bold sm:text-5xl">Guides</h1>
      <p class="mt-4 text-lg text-muted">Practical notes on links, campaigns and analytics.</p>
      <div *ngIf="blog.index$ | async as guides; else loading" class="mt-10 grid gap-4">
        <a *ngFor="let g of guides" [routerLink]="['/blog', g.slug]"
           class="block rounded-2xl border border-line bg-surface p-6 shadow-soft transition-colors hover:border-brand-glow/50">
          <p class="text-xs text-muted">{{ g.date | date: 'd MMMM y' }} · {{ g.readMinutes }} min read</p>
          <h2 class="mt-2 text-xl font-semibold">{{ g.title }}</h2>
          <p class="mt-2 text-sm text-muted">{{ g.description }}</p>
          <span class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">Read guide <z-icon name="arrow-right" [size]="16"></z-icon></span>
        </a>
      </div>
      <ng-template #loading>
        <div class="mt-10 grid gap-4" aria-busy="true"><div *ngFor="let i of [1, 2, 3]" class="h-36 animate-pulse rounded-2xl bg-surface-2"></div></div>
      </ng-template>
    </section>
  `,
})
export class BlogIndexComponent {
  constructor(public blog: BlogService) {}
}
