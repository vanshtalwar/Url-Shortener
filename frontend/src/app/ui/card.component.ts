import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'z-card',
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block rounded-2xl border border-line bg-surface p-6 shadow-soft' },
})
export class CardComponent {}
