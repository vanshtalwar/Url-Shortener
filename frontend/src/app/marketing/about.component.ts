import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mx-auto max-w-3xl px-4 py-16 lg:py-24">
      <h1 class="text-4xl font-bold sm:text-5xl">About Zelqit</h1>
      <div class="mt-8 space-y-5 text-lg leading-relaxed text-muted">
        <p>Zelqit is a link shortener with analytics you can actually rely on. It makes long URLs short and shareable, and shows you what happens after you share them.</p>
        <p>We built it around a few simple ideas. Numbers should be honest, so bots are kept out of your counts. Analytics shouldn't mean surveillance, so visitors are counted with a private one-way hash and raw IP addresses are never stored. And the basics should be free, so anyone can start without a card.</p>
        <p>Zelqit is an independent product based in India. If you have feedback or need help, we'd like to hear from you.</p>
      </div>
      <div class="mt-10 flex flex-wrap gap-3">
        <a zButton routerLink="/signup">Start free</a>
        <a zButton routerLink="/contact" variant="secondary">Contact us</a>
      </div>
    </article>
  `,
})
export class AboutComponent {}
