import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const SHOW_MS = 3000;

/** One short status message at a time ("Copied", "Link created"), announced to screen readers. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message$ = new BehaviorSubject<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string): void {
    clearTimeout(this.timer);
    this.message$.next(message);
    this.timer = setTimeout(() => this.message$.next(null), SHOW_MS);
  }
}
