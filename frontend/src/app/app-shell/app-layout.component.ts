import { ChangeDetectionStrategy, Component, HostListener, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import type { IconName } from '../ui/icon.component';
import { MeService } from '../me.service';
import { UpgradePromptService } from '../upgrade-prompt.service';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  exact: boolean;
}

/** Signed-in shell: sidebar (collapsible on mobile) + top bar with theme toggle and account menu. */
@Component({
  selector: 'app-app-layout',
  templateUrl: './app-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayoutComponent implements OnInit {
  sidebarOpen = false;
  accountOpen = false;
  readonly nav: NavItem[] = [
    { label: 'Overview', path: '/app', icon: 'chart', exact: true },
    { label: 'Links', path: '/app/links', icon: 'link', exact: false },
    { label: 'Link-in-bio', path: '/app/bio', icon: 'sparkles', exact: false },
    { label: 'Billing', path: '/app/billing', icon: 'credit-card', exact: false },
    { label: 'Settings', path: '/app/settings', icon: 'settings', exact: false },
  ];

  constructor(public auth: AuthService, public me: MeService, public upgrade: UpgradePromptService) {}

  ngOnInit(): void {
    this.me.refresh(); // fresh plan/usage for whoever just signed in
  }

  @HostListener('document:keydown.escape')
  closeMenus(): void {
    this.accountOpen = false;
    this.sidebarOpen = false;
  }
}
