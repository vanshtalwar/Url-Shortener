import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { LinksComponent } from './pages/links/links.component';
import { LinkDetailComponent } from './pages/link-detail/link-detail.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'links', component: LinksComponent, canActivate: [AuthGuard] },
  { path: 'links/:id', component: LinkDetailComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'links' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
