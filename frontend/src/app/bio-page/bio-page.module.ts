import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UiModule } from '../ui/ui.module';
import { BioViewModule } from '../bio-view/bio-view.module';
import { PublicBioComponent } from './public-bio.component';

@NgModule({
  declarations: [PublicBioComponent],
  imports: [CommonModule, UiModule, BioViewModule, RouterModule.forChild([{ path: '', component: PublicBioComponent }])],
})
export class BioPageModule {}
