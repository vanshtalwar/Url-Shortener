import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-60';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-glow hover:brightness-110',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'border border-danger/40 bg-surface text-danger hover:bg-danger/10',
};
const SIZES: Record<Size, string> = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

/** `<button zButton>` / `<a zButton>`: shared button look. `loading` shows a spinner and disables a <button>. */
@Component({
  selector: 'button[zButton], a[zButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<z-icon *ngIf="loading" name="loader" [size]="16" class="animate-spin"></z-icon><ng-content></ng-content>`,
})
export class ButtonComponent {
  @Input() variant: Variant = 'primary';
  @Input() size: Size = 'md';
  @Input() loading = false;

  @HostBinding('class') get classes(): string {
    return `${BASE} ${VARIANTS[this.variant]} ${SIZES[this.size]}`;
  }

  @HostBinding('attr.aria-busy') get busy(): boolean | null {
    return this.loading || null;
  }

  @Input() disabled = false;

  // A loading <button> can't be clicked again. (Anchors have no disabled state; style them instead.)
  @HostBinding('disabled') get isDisabled(): boolean {
    return this.disabled || this.loading;
  }
}
