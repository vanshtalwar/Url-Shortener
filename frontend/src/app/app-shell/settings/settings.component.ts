import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { MeService } from '../../me.service';
import { ThemePreference, ThemeService } from '../../ui/theme.service';
import { ToastService } from '../../ui/toast.service';
import { BUSINESS } from '../../marketing/business';
import { apiError } from '../../api-error';

const MIN_PASSWORD = 8;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  readonly minPassword = MIN_PASSWORD;
  readonly supportEmail = BUSINESS.supportEmail;
  readonly themes: { id: ThemePreference; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];
  current = '';
  next = '';
  confirm = '';
  saving = false;
  error = '';

  constructor(public me: MeService, public theme: ThemeService, private toast: ToastService, private cdr: ChangeDetectorRef) {}

  savePassword(hasPassword: boolean): void {
    this.saving = true;
    this.error = '';
    this.me.changePassword(this.next, hasPassword ? this.current : undefined).subscribe({
      next: () => {
        this.saving = false;
        this.current = this.next = this.confirm = '';
        this.toast.show(hasPassword ? 'Password changed' : 'Password set — you can now log in with email too');
        this.me.refresh();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.error = apiError(err).message;
        this.cdr.markForCheck();
      },
    });
  }
}
