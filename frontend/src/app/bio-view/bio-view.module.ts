import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BioViewComponent } from './bio-view.component';

/** Shared by the public bio page and the app's bio editor (preview). */
@NgModule({
  declarations: [BioViewComponent],
  imports: [CommonModule],
  exports: [BioViewComponent],
})
export class BioViewModule {}
