import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { GoogleSignInService } from '../../auth/google-sign-in.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('googleButton', { static: true }) googleButton!: ElementRef<HTMLDivElement>;
  error = '';
  private readonly destroy$ = new Subject<void>();

  constructor(private auth: AuthService, private router: Router, private googleSignIn: GoogleSignInService) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/links']);
      return;
    }
    this.googleSignIn.credential$.pipe(takeUntil(this.destroy$)).subscribe((credential) => this.signIn(credential));
    this.googleSignIn
      .renderButton(this.googleButton.nativeElement)
      .catch(() => (this.error = 'Could not load Google sign-in.'));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private signIn(credential: string): void {
    this.error = '';
    this.auth.login(credential).subscribe({
      next: () => this.router.navigate(['/links']),
      error: () => (this.error = 'Sign-in failed. Please try again.'),
    });
  }
}
