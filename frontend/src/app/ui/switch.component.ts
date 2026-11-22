import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/** On/off switch (role="switch"). Label it with the `label` input. */
@Component({
  selector: 'z-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" role="switch" [attr.aria-checked]="checked" [disabled]="disabled" (click)="checkedChange.emit(!checked)"
            class="inline-flex items-center gap-2 text-sm disabled:opacity-60">
      <span class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors" [ngClass]="checked ? 'bg-brand' : 'bg-line'">
        <span class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform" [ngClass]="checked ? 'translate-x-[18px]' : 'translate-x-0.5'"></span>
      </span>
      {{ label }}
    </button>
  `,
})
export class SwitchComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() label = '';
  @Output() checkedChange = new EventEmitter<boolean>();
}
