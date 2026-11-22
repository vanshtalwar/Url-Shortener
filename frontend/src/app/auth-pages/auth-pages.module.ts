import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { UiModule } from '../ui/ui.module';
import { AuthLayoutComponent } from './auth-layout.component';
import { GoogleButtonComponent } from './google-button.component';
import { LoginComponent } from './login.component';
import { SignupComponent } from './signup.component';
import { CheckEmailComponent } from './check-email.component';
import { VerifyEmailComponent } from './verify-email.component';
import { ForgotPasswordComponent } from './forgot-password.component';
import { ResetPasswordComponent } from './reset-password.component';

const routes: Routes = [
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent, title: 'Log in · Zelqit' },
      { path: 'signup', component: SignupComponent, title: 'Sign up · Zelqit' },
      { path: 'check-email', component: CheckEmailComponent, title: 'Check your email · Zelqit' },
      { path: 'verify-email', component: VerifyEmailComponent, title: 'Verify email · Zelqit' },
      { path: 'forgot-password', component: ForgotPasswordComponent, title: 'Forgot password · Zelqit' },
      { path: 'reset-password', component: ResetPasswordComponent, title: 'Reset password · Zelqit' },
    ],
  },
];

@NgModule({
  declarations: [
    AuthLayoutComponent, GoogleButtonComponent, LoginComponent, SignupComponent, CheckEmailComponent,
    VerifyEmailComponent, ForgotPasswordComponent, ResetPasswordComponent,
  ],
  imports: [CommonModule, FormsModule, UiModule, RouterModule.forChild(routes)],
})
export class AuthPagesModule {}
