import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUSINESS } from './business';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-16 lg:py-24">
      <h1 class="text-4xl font-bold sm:text-5xl">Contact</h1>
      <p class="mt-4 text-lg text-muted">Questions about your account, billing or anything else — email us and we'll get back to you.</p>
      <div class="mt-10 grid gap-4 sm:grid-cols-2">
        <z-card>
          <z-icon name="link" class="text-accent"></z-icon>
          <h2 class="mt-3 font-semibold">Email</h2>
          <a [href]="'mailto:' + business.supportEmail" class="mt-1 block break-all text-accent hover:underline">{{ business.supportEmail }}</a>
        </z-card>
        <z-card>
          <z-icon name="globe" class="text-accent"></z-icon>
          <h2 class="mt-3 font-semibold">Address</h2>
          <address class="mt-1 not-italic text-muted">{{ business.legalName }}<br />{{ business.address }}</address>
        </z-card>
      </div>
    </section>
  `,
})
export class ContactComponent {
  readonly business = BUSINESS;
}
