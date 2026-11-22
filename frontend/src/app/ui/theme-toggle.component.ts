import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { IconName } from './icon.component';
import { ThemePreference, ThemeService } from './theme.service';

const ICON: Record<ThemePreference, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };
const NEXT_LABEL: Record<ThemePreference, string> = {
  system: 'Theme: system. Switch to light',
  light: 'Theme: light. Switch to dark',
  dark: 'Theme: dark. Switch to system',
};

@Component({
  selector: 'z-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button *ngIf="theme.preference$ | async as pref" type="button" zButton variant="ghost" size="sm"
            class="!px-2" [attr.aria-label]="label(pref)" [title]="label(pref)" (click)="theme.cycle()">
      <z-icon [name]="icon(pref)" [size]="18"></z-icon>
    </button>
  `,
})
export class ThemeToggleComponent {
  constructor(public theme: ThemeService) {}

  icon(pref: ThemePreference): IconName {
    return ICON[pref];
  }

  label(pref: ThemePreference): string {
    return NEXT_LABEL[pref];
  }
}
