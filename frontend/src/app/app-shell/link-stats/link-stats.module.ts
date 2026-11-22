import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UiModule } from '../../ui/ui.module';
import { ChartsModule } from '../../charts/charts.module';
import { LinkStatsComponent } from './link-stats.component';
import { BreakdownCardComponent } from './breakdown-card.component';
import { WorldMapComponent } from './world-map.component';

/** Lazy: the map code (d3-geo, topojson) only loads when a stats page opens. */
@NgModule({
  declarations: [LinkStatsComponent, BreakdownCardComponent, WorldMapComponent],
  imports: [CommonModule, UiModule, ChartsModule, RouterModule.forChild([{ path: '', component: LinkStatsComponent }])],
})
export class LinkStatsModule {}
