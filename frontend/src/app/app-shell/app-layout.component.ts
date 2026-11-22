import { ChangeDetectionStrategy, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { startAfterFirstPaint } from '../experience-loader';
import type { IconName } from '../ui/icon.component';
import { MeService } from '../me.service';
import { ParticlesPreferenceService } from '../ui/particles-preference.service';
import { UpgradePromptService } from '../upgrade-prompt.service';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  exact: boolean;
}

/**
 * Signed-in shell: sidebar (collapsible on mobile) + top bar with theme toggle and account menu, and the background
 * particles (experience/backdrop.ts, its own chunk) unless switched off in Settings or reduced motion is asked for.
 */
@Component({
  selector: 'app-app-layout',
  templateUrl: './app-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = false;
  accountOpen = false;
  readonly nav: NavItem[] = [
    { label: 'Overview', path: '/app', icon: 'chart', exact: true },
    { label: 'Links', path: '/app/links', icon: 'link', exact: false },
    { label: 'Link-in-bio', path: '/app/bio', icon: 'sparkles', exact: false },
    { label: 'Billing', path: '/app/billing', icon: 'credit-card', exact: false },
    { label: 'Settings', path: '/app/settings', icon: 'settings', exact: false },
  ];

  private particlesOn?: Subscription;
  private stopParticles?: () => void;

  constructor(
    public auth: AuthService,
    public me: MeService,
    public upgrade: UpgradePromptService,
    private particles: ParticlesPreferenceService,
    private host: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    this.me.refresh(); // fresh plan/usage for whoever just signed in
    this.particlesOn = this.particles.on$.subscribe((on) => {
      this.stopParticles?.();
      this.stopParticles = on
        ? startAfterFirstPaint(this.zone, () => import('../experience/backdrop'), ({ startBackdrop }) => startBackdrop(this.host.nativeElement))
        : undefined;
    });
  }

  ngOnDestroy(): void {
    this.particlesOn?.unsubscribe();
    this.stopParticles?.();
  }

  @HostListener('document:keydown.escape')
  closeMenus(): void {
    this.accountOpen = false;
    this.sidebarOpen = false;
  }
}
