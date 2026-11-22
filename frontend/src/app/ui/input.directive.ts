import { Directive, HostBinding } from '@angular/core';

/** `<input zInput>` / `<textarea zInput>` / `<select zInput>`: shared field look. */
@Directive({ selector: 'input[zInput], textarea[zInput], select[zInput]' })
export class InputDirective {
  @HostBinding('class') readonly classes =
    'block w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted/70 ' +
    'transition-colors focus:border-brand-glow focus:outline-none focus:ring-2 focus:ring-brand-glow/40 disabled:opacity-60';
}
