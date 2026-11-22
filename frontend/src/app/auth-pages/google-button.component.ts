import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { GoogleSignInService } from '../auth/google-sign-in.service';
import { apiError } from '../api-error';

/** Google's sign-in button; signs in with our API and emits `signedIn`, or `failed` with a message. */
@Component({
  selector: 'app-google-button',
  host: { class: 'flex min-h-[44px] justify-center' },
  template: `<div #button></div>`,
})
export class GoogleButtonComponent implements OnInit, OnDestroy {
  @ViewChild('button', { static: true }) button!: ElementRef<HTMLDivElement>;
  @Output() signedIn = new EventEmitter<void>();
  @Output() failed = new EventEmitter<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(private auth: AuthService, private google: GoogleSignInService) {}

  ngOnInit(): void {
    this.google.credential$.pipe(takeUntil(this.destroy$)).subscribe((credential) =>
      this.auth.loginWithGoogle(credential).subscribe({
        next: () => this.signedIn.emit(),
        error: (err) => this.failed.emit(apiError(err).message),
      }),
    );
    this.google.renderButton(this.button.nativeElement).catch(() => this.failed.emit('Could not load Google sign-in.'));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
