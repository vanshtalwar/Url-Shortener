import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import type { DayCount } from './api-types';

// Shapes from the API contract (prompts/zelqit-backend.md). Keep in sync with the backend.

interface LinkSummary {
  id: string;
  code: string;
  url: string;
  expiresAt: string | null;
}

export interface Variant {
  url: string;
  weight: number; // relative; the editor keeps them summing to 100
}

export interface Link extends LinkSummary {
  clickCount: number; // human clicks (Free: last 30 days)
  hasPassword: boolean;
  variants: Variant[];
  folderId: string | null;
  tags: string[];
}

/** Body for create (url required) and update (any subset). */
export interface LinkInput {
  url?: string;
  alias?: string;
  expiresAt?: string | null; // null removes the expiry
  password?: string | null; // null removes the password
  variants?: Variant[]; // [] removes the A/B split
  folderId?: string | null;
  tags?: string[];
}

export interface LinkFilters {
  q?: string;
  folder?: string;
  tag?: string;
}

export interface Folder {
  id: string;
  name: string;
  linkCount: number;
}

export interface UtmPreset {
  id: string;
  name: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}

interface CountItem {
  value: string;
  count: number;
}

export interface LinkStats {
  link: LinkSummary;
  total: number;
  uniqueVisitors: number;
  botClicks: number;
  historyLimited: boolean; // Free: older clicks exist but are hidden
  clicksPerDay: DayCount[];
  referrers: CountItem[];
  browsers: CountItem[];
  operatingSystems: CountItem[];
  devices: CountItem[];
  countries: CountItem[] | null; // null on Free
  cities: CountItem[] | null;
  variants: { url: string; clicks: number }[] | null; // null without an A/B split
}

const api = environment.apiUrl;

export function shortUrl(code: string): string {
  return `${api}/${code}`;
}

/** Pure: pass the current time in. */
export function isExpired(expiresAt: string | null, now: number): boolean {
  return expiresAt !== null && Date.parse(expiresAt) <= now;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  constructor(private http: HttpClient) {}

  list(filters: LinkFilters = {}): Observable<Link[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value) params = params.set(key, value);
    return this.http.get<Link[]>(`${api}/api/links`, { params });
  }

  create(input: LinkInput): Observable<Link> {
    return this.http.post<Link>(`${api}/api/links`, input);
  }

  update(id: string, changes: LinkInput): Observable<Link> {
    return this.http.patch<Link>(`${api}/api/links/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${api}/api/links/${id}`);
  }

  stats(id: string, includeBots: boolean): Observable<LinkStats> {
    return this.http.get<LinkStats>(`${api}/api/links/${id}/stats`, { params: { bots: String(includeBots) } });
  }

  folders(): Observable<Folder[]> {
    return this.http.get<Folder[]>(`${api}/api/folders`);
  }

  createFolder(name: string): Observable<Folder> {
    return this.http.post<Folder>(`${api}/api/folders`, { name });
  }

  renameFolder(id: string, name: string): Observable<Folder> {
    return this.http.patch<Folder>(`${api}/api/folders/${id}`, { name });
  }

  deleteFolder(id: string): Observable<void> {
    return this.http.delete<void>(`${api}/api/folders/${id}`);
  }

  utmPresets(): Observable<UtmPreset[]> {
    return this.http.get<UtmPreset[]>(`${api}/api/utm-presets`);
  }

  createUtmPreset(preset: Omit<UtmPreset, 'id'>): Observable<UtmPreset> {
    return this.http.post<UtmPreset>(`${api}/api/utm-presets`, preset);
  }

  deleteUtmPreset(id: string): Observable<void> {
    return this.http.delete<void>(`${api}/api/utm-presets/${id}`);
  }
}
