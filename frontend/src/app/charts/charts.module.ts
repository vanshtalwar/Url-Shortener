import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClicksChartComponent } from './clicks-chart.component';

/** chart.js lives here (not in UiModule) so marketing pages never download it. */
@NgModule({
  declarations: [ClicksChartComponent],
  imports: [CommonModule],
  exports: [ClicksChartComponent],
})
export class ChartsModule {}
