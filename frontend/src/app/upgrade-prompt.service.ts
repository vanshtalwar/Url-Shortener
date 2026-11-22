import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Shows the upgrade dialog (rendered by the app shell). `reason` is the API's message or our own. */
@Injectable({ providedIn: 'root' })
export class UpgradePromptService {
  readonly reason$ = new BehaviorSubject<string | null>(null);

  open(reason: string): void {
    this.reason$.next(reason);
  }

  close(): void {
    this.reason$.next(null);
  }
}
