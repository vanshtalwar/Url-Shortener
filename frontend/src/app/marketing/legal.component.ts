import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BUSINESS } from './business';
import { LEGAL_PAGES, type LegalPage } from './legal-content';

/** Renders Terms / Privacy / Refunds; which one comes from route data `page`. */
@Component({
  selector: 'app-legal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mx-auto max-w-3xl px-4 py-16 lg:py-20">
      <h1 class="text-4xl font-bold">{{ page.title }}</h1>
      <p class="mt-2 text-sm text-muted">Last updated {{ lastUpdated }}</p>
      <p class="mt-6 text-lg leading-relaxed text-muted">{{ page.intro }}</p>
      <section *ngFor="let s of page.sections" class="mt-10">
        <h2 class="text-xl font-semibold">{{ s.heading }}</h2>
        <p *ngFor="let p of s.paragraphs" class="mt-3 leading-relaxed text-muted">{{ p }}</p>
      </section>
    </article>
  `,
})
export class LegalComponent {
  readonly page: LegalPage = LEGAL_PAGES[this.route.snapshot.data['page'] as keyof typeof LEGAL_PAGES];
  readonly lastUpdated = BUSINESS.lastUpdated;
  constructor(private route: ActivatedRoute) {}
}
