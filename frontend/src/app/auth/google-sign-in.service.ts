import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

// Global from Google Identity Services.
declare const google: any;

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Loads and initializes Google Identity Services once per app session, however often /login is visited. */
@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
  private ready?: Promise<void>;
  private readonly credentials = new Subject<string>();

  /** Emits the Google ID token each time the user completes sign-in. */
  readonly credential$: Observable<string> = this.credentials.asObservable();

  constructor(private zone: NgZone) {}

  async renderButton(element: HTMLElement): Promise<void> {
    await this.load();
    if (!element.isConnected) return; // the page was left while the script loaded
    google.accounts.id.renderButton(element, { theme: 'outline', size: 'large' });
  }

  private load(): Promise<void> {
    this.ready ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.onload = () => {
        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          // Google calls this outside Angular's zone; re-enter so views update.
          callback: (response: { credential: string }) => this.zone.run(() => this.credentials.next(response.credential)),
        });
        resolve();
      };
      script.onerror = () => {
        script.remove();
        this.ready = undefined; // allow a retry on the next visit
        reject(new Error('Could not load Google sign-in'));
      };
      document.head.appendChild(script);
    });
    return this.ready;
  }
}
