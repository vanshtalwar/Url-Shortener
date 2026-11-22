import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';
import { BlogService } from './blog.service';

@Component({
  selector: 'app-blog-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="guide$ | async as guide; else missing">
      <article class="mx-auto max-w-3xl px-4 py-16 lg:py-20">
        <a routerLink="/blog" class="text-sm text-accent hover:underline">← All guides</a>
        <p class="mt-6 text-sm text-muted">{{ guide.date | date: 'd MMMM y' }} · {{ guide.readMinutes }} min read</p>
        <h1 class="mt-2 text-4xl font-bold sm:text-5xl">{{ guide.title }}</h1>
        <!-- Our own Markdown files; Angular's sanitizer still cleans the HTML. -->
        <div class="prose prose-lg mt-10 max-w-none dark:prose-invert prose-headings:font-display prose-a:text-accent prose-code:before:content-none prose-code:after:content-none"
             [innerHTML]="guide.html"></div>
        <aside class="mt-16 rounded-2xl bg-brand p-8 text-center text-white">
          <h2 class="text-2xl font-bold">Try it with your own links</h2>
          <p class="mt-2 text-white/80">Free plan · no card needed.</p>
          <a zButton routerLink="/signup" variant="secondary" class="mt-6 !border-white/20 !bg-white !text-[#14121f] hover:!bg-white/90">Start free</a>
        </aside>
      </article>
    </ng-container>
    <ng-template #missing>
      <div *ngIf="!loaded" class="mx-auto max-w-3xl px-4 py-16" aria-busy="true">
        <div class="h-10 w-2/3 animate-pulse rounded-xl bg-surface-2"></div>
        <div class="mt-8 space-y-3"><div *ngFor="let i of [1, 2, 3, 4, 5]" class="h-4 animate-pulse rounded bg-surface-2"></div></div>
      </div>
      <section *ngIf="loaded" class="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 class="text-3xl font-bold">Guide not found</h1>
        <a zButton routerLink="/blog" variant="secondary" class="mt-6">See all guides</a>
      </section>
    </ng-template>
  `,
})
export class BlogArticleComponent {
  loaded = false;
  readonly guide$ = this.route.paramMap.pipe(
    map((params) => params.get('slug') ?? ''),
    switchMap((slug) => this.blog.guide(slug)),
    tap((guide) => {
      this.loaded = true;
      if (!guide) return this.title.setTitle('Guide not found · Zelqit');
      this.title.setTitle(`${guide.title} · Zelqit`);
      this.meta.updateTag({ name: 'description', content: guide.description });
    }),
  );

  constructor(private route: ActivatedRoute, private blog: BlogService, private title: Title, private meta: Meta) {}
}
