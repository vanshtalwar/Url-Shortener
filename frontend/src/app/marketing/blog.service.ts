import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, switchMap, of } from 'rxjs';
import { marked } from 'marked';

interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  readMinutes: number;
}

export interface Guide extends GuideMeta {
  html: string;
}

/** Guides are Markdown files in src/assets/blog/ listed in index.json — edit those files to change the content. */
@Injectable({ providedIn: 'root' })
export class BlogService {
  readonly index$: Observable<GuideMeta[]> = this.http.get<GuideMeta[]>('assets/blog/index.json').pipe(shareReplay(1));

  constructor(private http: HttpClient) {}

  /** The guide for a slug listed in index.json, or null (unknown slugs never trigger a file request). */
  guide(slug: string): Observable<Guide | null> {
    return this.index$.pipe(
      map((all) => all.find((g) => g.slug === slug) ?? null),
      switchMap((meta) =>
        meta
          ? this.http.get(`assets/blog/${meta.slug}.md`, { responseType: 'text' }).pipe(map((md) => ({ ...meta, html: marked.parse(md) })))
          : of(null),
      ),
    );
  }
}
