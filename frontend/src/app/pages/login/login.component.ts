import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';

// Global from Google Identity Services (https://accounts.google.com/gsi/client).
declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  @ViewChild('googleButton', { static: true }) googleButton!: ElementRef<HTMLDivElement>;
  error = '';

  constructor(private auth: AuthService, private router: Router, private zone: NgZone) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/links']);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => this.renderButton();
    script.onerror = () => this.zone.run(() => (this.error = 'Could not load Google sign-in.'));
    document.head.appendChild(script);
  }

  private renderButton(): void {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      // Google calls this outside Angular's zone; re-enter so the view updates.
      callback: (response: { credential: string }) => this.zone.run(() => this.signIn(response.credential)),
    });
    google.accounts.id.renderButton(this.googleButton.nativeElement, { theme: 'outline', size: 'large' });
  }

  private signIn(credential: string): void {
    this.error = '';
    this.auth.login(credential).subscribe({
      next: () => this.router.navigate(['/links']),
      error: () => (this.error = 'Sign-in failed. Please try again.'),
    });
  }
}
