import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface Link {
  id: string;
  code: string;
  url: string;
  expiresAt: string | null;
  clickCount: number;
  createdAt: string;
}

export interface LinkInput {
  url?: string;
  alias?: string;
  expiresAt?: string | null;
}

export interface CountItem {
  value: string;
  count: number;
}

export interface LinkStats {
  link: Link;
  includeBots: boolean;
  total: number;
  uniqueVisitors: number;
  botClicks: number;
  clicksPerDay: { date: string; count: number }[];
  referrers: CountItem[];
  browsers: CountItem[];
  os: CountItem[];
  devices: CountItem[];
}

const base = `${environment.apiUrl}/api/links`;

export function shortUrl(code: string): string {
  return `${environment.apiUrl}/${code}`;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  constructor(private http: HttpClient) {}

  list(): Observable<Link[]> {
    return this.http.get<Link[]>(base);
  }

  create(input: LinkInput): Observable<Link> {
    return this.http.post<Link>(base, input);
  }

  update(id: string, input: LinkInput): Observable<Link> {
    return this.http.patch<Link>(`${base}/${id}`, input);
  }

  stats(id: string, includeBots: boolean): Observable<LinkStats> {
    return this.http.get<LinkStats>(`${base}/${id}/stats`, { params: { bots: String(includeBots) } });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${base}/${id}`);
  }
}
