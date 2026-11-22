import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { geoArea, geoCentroid, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Feature, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { GlobeOrigin } from '../../experience/globe';
import { ALPHA2_TO_NUMERIC } from './country-codes';
import { countryName } from './countries';

interface Shape {
  id: string; // ISO numeric
  d: string; // SVG path
  name: string;
  centre: [number, number]; // longitude, latitude: where the 3D globe marks it
}

const WIDTH = 960;
const HEIGHT = 480;
const GLOBE_COUNTRIES = 12; // marked on the 3D globe: the top ones
let shapesCache: Promise<Shape[]> | undefined; // the map outline is the same for every link

/** The middle of a country's largest landmass: France's, not a point between it and French Guiana. */
function mainlandCentre(country: Feature): [number, number] {
  const g = country.geometry;
  const parts: Polygon[] = g.type === 'MultiPolygon' ? g.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates })) : g.type === 'Polygon' ? [g] : [];
  const largest = parts.reduce<Polygon | undefined>((a, b) => (!a || geoArea(b) > geoArea(a) ? b : a), undefined);
  return geoCentroid(largest ?? country);
}

/**
 * Choropleth of clicks by country. Shapes: world-atlas 110m (copied to assets/geo at build time). The 3D globe
 * (prompts/zelqit-frontend.md §4, X9) is drawn over it, marking the top countries with their clicks flying in; the
 * map stays as its fallback (no WebGL, reduced motion, slow devices) and its text alternative.
 */
@Component({
  selector: 'app-world-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <z-scene kind="globe" [data]="globe">
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="h-auto w-full" role="img" [attr.aria-label]="summary">
        <g *ngIf="shapes.length; else loading">
          <path *ngFor="let s of shapes; trackBy: trackById" [attr.d]="s.d" class="stroke-canvas" stroke-width="0.5"
                [attr.fill]="fill(s.id)"><title>{{ tooltip(s) }}</title></path>
        </g>
        <ng-template #loading><rect [attr.width]="width" [attr.height]="height" rx="12" class="animate-pulse fill-surface-2"></rect></ng-template>
      </svg>
    </z-scene>
    <p *ngIf="error" class="mt-2 text-xs text-muted">{{ error }}</p>
  `,
})
export class WorldMapComponent implements OnInit, OnChanges {
  @Input() countries: { value: string; count: number }[] = [];
  readonly width = WIDTH;
  readonly height = HEIGHT;
  shapes: Shape[] = [];
  error = '';
  summary = '';
  globe: { origins: GlobeOrigin[] } = { origins: [] };
  private counts = new Map<string, number>(); // ISO numeric → clicks
  private max = 0;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    shapesCache ??= this.loadShapes();
    shapesCache.then(
      (shapes) => {
        this.shapes = shapes;
        this.updateGlobe();
        this.cdr.markForCheck();
      },
      () => {
        shapesCache = undefined; // allow a retry next time
        this.error = 'The map could not be loaded; the table has the same data.';
        this.cdr.markForCheck();
      },
    );
  }

  ngOnChanges(): void {
    this.counts = new Map(
      this.countries.flatMap((c) => (ALPHA2_TO_NUMERIC[c.value] ? [[ALPHA2_TO_NUMERIC[c.value], c.count] as const] : [])),
    );
    this.max = Math.max(0, ...this.counts.values());
    const top = this.countries.filter((c) => c.value !== 'Unknown').slice(0, 3).map((c) => `${countryName(c.value)} ${c.count}`);
    this.summary = `World map of clicks by country${top.length ? `. Top: ${top.join(', ')}` : ''}`;
    this.updateGlobe();
  }

  /** Brand colour, more opaque for more clicks; countries without clicks stay neutral. */
  fill(id: string): string {
    const count = this.counts.get(id) ?? 0;
    if (count === 0 || this.max === 0) return 'rgb(var(--surface-2))';
    return `rgb(var(--brand-glow) / ${(0.25 + 0.75 * (count / this.max)).toFixed(2)})`;
  }

  tooltip(shape: Shape): string {
    return `${shape.name}: ${this.counts.get(shape.id) ?? 0} clicks`;
  }

  trackById(_: number, s: Shape): string {
    return s.id;
  }

  /** The top countries with a shape, most clicks first (the globe turns the first to face you), sized by clicks. */
  private updateGlobe(): void {
    const centres = new Map(this.shapes.map((s) => [s.id, s.centre]));
    const origins = [...this.counts]
      .sort((a, b) => b[1] - a[1])
      .flatMap(([id, count]) => {
        const centre = centres.get(id);
        return centre ? [{ lon: centre[0], lat: centre[1], weight: count / this.max }] : [];
      })
      .slice(0, GLOBE_COUNTRIES);
    this.globe = { origins };
  }

  private async loadShapes(): Promise<Shape[]> {
    const topology = await firstValueFrom(this.http.get<Topology>('assets/geo/countries-110m.json'));
    const countries = feature(topology, topology.objects['countries'] as GeometryCollection<{ name: string }>);
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], countries);
    const path = geoPath(projection);
    return countries.features
      .filter((f) => f.id !== undefined)
      .map((f) => ({ id: String(f.id), d: path(f) ?? '', name: f.properties?.name ?? String(f.id), centre: mainlandCentre(f) }));
  }
}
