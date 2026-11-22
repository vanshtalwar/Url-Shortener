import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map } from 'rxjs';

const STORAGE_KEY = 'zelqit-particles';

function readChoice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true; // storage blocked (private mode etc.): the default
  }
}

/**
 * The dashboard's background particles (prompts/zelqit-frontend.md §4.3-11): on unless switched off in Settings
 * (saved per device), and always off while the device asks for reduced motion — without forgetting the choice.
 */
@Injectable({ providedIn: 'root' })
export class ParticlesPreferenceService {
  private readonly reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** The Settings switch. */
  readonly chosen$ = new BehaviorSubject<boolean>(readChoice());
  readonly reducedMotion$ = new BehaviorSubject<boolean>(this.reducedMotionQuery.matches);
  /** Whether the particles run. */
  readonly on$ = combineLatest([this.chosen$, this.reducedMotion$]).pipe(
    map(([chosen, reducedMotion]) => chosen && !reducedMotion),
    distinctUntilChanged(),
  );

  constructor() {
    this.reducedMotionQuery.addEventListener('change', (e) => this.reducedMotion$.next(e.matches));
  }

  set(on: boolean): void {
    try {
      if (on) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, 'off');
    } catch {
      // still switches for this visit
    }
    this.chosen$.next(on);
  }
}
