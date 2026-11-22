import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ToastService } from './toast.service';

/** Place once per layout. The live region always exists so screen readers announce new messages. */
@Component({
  selector: 'z-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <p *ngIf="toast.message$ | async as message" class="pointer-events-auto rounded-xl border border-line bg-surface px-4 py-2 text-sm shadow-soft">
        {{ message }}
      </p>
    </div>
  `,
})
export class ToastHostComponent {
  constructor(public toast: ToastService) {}
}
