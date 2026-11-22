import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { LinksComponent } from './pages/links/links.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'links', component: LinksComponent, canActivate: [AuthGuard] },
  {
    path: 'links/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/link-detail/link-detail.module').then((m) => m.LinkDetailModule),
  },
  { path: '**', redirectTo: 'links' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
