import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LinkDetailComponent } from './link-detail.component';

/** Lazy-loaded, so chart.js is only downloaded when a stats page is opened. */
@NgModule({
  declarations: [LinkDetailComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild([{ path: '', component: LinkDetailComponent }])],
})
export class LinkDetailModule {}
