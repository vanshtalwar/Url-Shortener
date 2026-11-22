import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeComponent } from './badge.component';
import { ButtonComponent } from './button.component';
import { CardComponent } from './card.component';
import { DrawerComponent } from './drawer.component';
import { IconComponent } from './icon.component';
import { InputDirective } from './input.directive';
import { LogoComponent } from './logo.component';
import { ModalComponent } from './modal.component';
import { StatTileComponent } from './stat-tile.component';
import { SwitchComponent } from './switch.component';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ToastHostComponent } from './toast-host.component';
import { UsageMeterComponent } from './usage-meter.component';

const PARTS = [
  BadgeComponent, ButtonComponent, CardComponent, DrawerComponent, IconComponent, InputDirective, LogoComponent,
  ModalComponent, StatTileComponent, SwitchComponent, ThemeToggleComponent, ToastHostComponent, UsageMeterComponent,
];

/** Zelqit's shared UI building blocks. Import into any feature module. */
@NgModule({
  declarations: PARTS,
  imports: [CommonModule],
  exports: PARTS,
})
export class UiModule {}
