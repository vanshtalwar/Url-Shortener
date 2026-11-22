import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { authMatcher, bioMatcher } from './route-matchers';

// Each area is its own lazy chunk, so the landing page never downloads the dashboard.
const routes: Routes = [
  // Old URLs from before the redesign.
  { path: 'links', pathMatch: 'full', redirectTo: 'app/links' },
  { path: 'links/:id', redirectTo: 'app/links/:id' },

  { path: 'app', canActivate: [AuthGuard], loadChildren: () => import('./app-shell/app-shell.module').then((m) => m.AppShellModule) },
  { matcher: authMatcher, loadChildren: () => import('./auth-pages/auth-pages.module').then((m) => m.AuthPagesModule) },
  { matcher: bioMatcher, loadChildren: () => import('./bio-page/bio-page.module').then((m) => m.BioPageModule) },
  { path: '', loadChildren: () => import('./marketing/marketing.module').then((m) => m.MarketingModule) },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
