import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

interface LinkSummary {
  id: string;
  code: string;
  url: string;
  expiresAt: string | null;
}

export interface Link extends LinkSummary {
  clickCount: number; // human clicks
}

export interface LinkInput {
  url?: string;
  alias?: string;
  expiresAt?: string | null; // null removes the expiry
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
  clicksPerDay: { date: string; count: number }[];
  referrers: CountItem[];
  browsers: CountItem[];
  operatingSystems: CountItem[];
  devices: CountItem[];
}

const linksUrl = `${environment.apiUrl}/api/links`;

export function shortUrl(code: string): string {
  return `${environment.apiUrl}/${code}`;
}

/** Pure: pass the current time in. */
export function isExpired(expiresAt: string | null, now: number): boolean {
  return expiresAt !== null && Date.parse(expiresAt) <= now;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  constructor(private http: HttpClient) {}

  list(): Observable<Link[]> {
    return this.http.get<Link[]>(linksUrl);
  }

  create(input: LinkInput): Observable<Link> {
    return this.http.post<Link>(linksUrl, input);
  }

  update(id: string, changes: LinkInput): Observable<Link> {
    return this.http.patch<Link>(`${linksUrl}/${id}`, changes);
  }

  stats(id: string, includeBots: boolean): Observable<LinkStats> {
    return this.http.get<LinkStats>(`${linksUrl}/${id}/stats`, { params: { bots: String(includeBots) } });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${linksUrl}/${id}`);
  }
}
