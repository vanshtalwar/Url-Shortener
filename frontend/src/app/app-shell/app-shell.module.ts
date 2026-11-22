import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { UiModule } from '../ui/ui.module';
import { AppLayoutComponent } from './app-layout.component';
import { LinksPageComponent } from './links/links-page.component';
import { LinkEditorComponent } from './links/link-editor.component';
import { TagInputComponent } from './links/tag-input.component';
import { QrDialogComponent } from './links/qr-dialog.component';
import { FolderManagerComponent } from './links/folder-manager.component';
import { OverviewComponent } from './overview.component';
import { ChartsModule } from '../charts/charts.module';
import { BioViewModule } from '../bio-view/bio-view.module';
import { BioEditorComponent } from './bio/bio-editor.component';
import { BillingComponent } from './billing/billing.component';
import { SettingsComponent } from './settings/settings.component';

const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', component: OverviewComponent, title: 'Overview · Zelqit' },
      { path: 'links', component: LinksPageComponent, title: 'Links · Zelqit' },
      { path: 'links/:id', title: 'Link stats · Zelqit', loadChildren: () => import('./link-stats/link-stats.module').then((m) => m.LinkStatsModule) },
      { path: 'bio', component: BioEditorComponent, title: 'Link-in-bio · Zelqit' },
      { path: 'billing', component: BillingComponent, title: 'Billing · Zelqit' },
      { path: 'settings', component: SettingsComponent, title: 'Settings · Zelqit' },
    ],
  },
];

@NgModule({
  declarations: [
    AppLayoutComponent, OverviewComponent, LinksPageComponent, LinkEditorComponent, TagInputComponent, QrDialogComponent, FolderManagerComponent,
    BioEditorComponent, BillingComponent, SettingsComponent,
  ],
  imports: [CommonModule, FormsModule, UiModule, ChartsModule, BioViewModule, RouterModule.forChild(routes)],
})
export class AppShellModule {}
