import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import type { Bio, PublicBio } from './api-types';

@Injectable({ providedIn: 'root' })
export class BioService {
  constructor(private http: HttpClient) {}

  mine(): Observable<Bio | null> {
    return this.http.get<Bio | null>(`${environment.apiUrl}/api/bio`);
  }

  save(bio: Bio): Observable<Bio> {
    return this.http.put<Bio>(`${environment.apiUrl}/api/bio`, bio);
  }

  remove(): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/bio`);
  }

  publicPage(handle: string): Observable<PublicBio> {
    return this.http.get<PublicBio>(`${environment.apiUrl}/api/public/bio/${encodeURIComponent(handle)}`);
  }
}
