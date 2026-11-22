import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'zelqit-theme';
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system'; // storage blocked (private mode etc.)
  }
}

/**
 * Light/dark theme: follows the OS unless the user picks one. The inline script in index.html applies it first.
 * Marketing pages call `followSystem(true)`: they always use the OS setting, and the saved choice comes back
 * when the visitor returns to the dashboard.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  readonly preference$ = new BehaviorSubject<ThemePreference>(readPreference());
  private systemOnly = false;

  constructor() {
    this.systemDark.addEventListener('change', () => this.apply());
    this.apply();
  }

  get isDark(): boolean {
    const pref = this.systemOnly ? 'system' : this.preference$.value;
    return pref === 'dark' || (pref === 'system' && this.systemDark.matches);
  }

  /** While on, ignore the saved choice (without forgetting it). */
  followSystem(on: boolean): void {
    this.systemOnly = on;
    this.apply();
  }

  /** system → light → dark → system */
  cycle(): void {
    this.set(ORDER[(ORDER.indexOf(this.preference$.value) + 1) % ORDER.length]);
  }

  set(preference: ThemePreference): void {
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // still switch for this visit
    }
    this.preference$.next(preference);
    this.apply();
  }

  private apply(): void {
    document.documentElement.classList.toggle('dark', this.isDark);
  }
}
