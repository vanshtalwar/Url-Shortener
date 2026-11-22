import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { Me } from '../../api-types';
import { Folder, Link, LinksService, UtmPreset, shortUrl } from '../../links.service';
import { apiError } from '../../api-error';
import { Abilities, LinkForm, buildChanges, formFor } from './link-form';
import { UTM_KEYS, applyUtm, emptyUtm, type UtmKey } from './utm';
import { evenWeights, rebalance } from './weights';

const MAX_VARIANTS = 5;

/** Create / edit drawer for one link. Emits the saved link; the page reloads its list. */
@Component({
  selector: 'app-link-editor',
  templateUrl: './link-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkEditorComponent implements OnInit {
  @Input() link: Link | null = null; // null = create
  @Input() me!: Me;
  @Input() folders: Folder[] = [];
  @Input() initialUrl = '';
  @Output() saved = new EventEmitter<Link>();
  @Output() closed = new EventEmitter<void>();

  form!: LinkForm;
  can!: Abilities;
  presets: UtmPreset[] = [];
  presetName = '';
  changingPassword = false;
  saving = false;
  error = '';
  aliasError = '';
  readonly utmKeys = UTM_KEYS;
  readonly maxVariants = MAX_VARIANTS;
  readonly shortUrl = shortUrl;

  constructor(private links: LinksService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const can = this.me.entitlements.can;
    this.can = { utm: can.utmPresets, variants: can.variants, folders: can.folders };
    this.form = formFor(this.link, this.can, this.initialUrl);
    if (this.can.utm) {
      this.links.utmPresets().subscribe((presets) => {
        this.presets = presets;
        this.cdr.markForCheck();
      });
    }
  }

  get title(): string {
    return this.link ? `Edit ${this.link.code}` : 'New short link';
  }

  /** The URL that will be saved (destination + UTM), for the live preview. */
  get finalUrl(): string {
    return applyUtm(this.form.base.trim(), this.can.utm ? this.form.utm : emptyUtm());
  }

  get aliasChanged(): boolean {
    return Boolean(this.link) && this.form.alias.trim() !== this.link!.code;
  }

  /** Pro data kept after a downgrade is shown but can't be edited. */
  get variantsReadOnly(): boolean {
    return !this.can.variants;
  }

  utmLabel(key: UtmKey): string {
    return { source: 'Source', medium: 'Medium', campaign: 'Campaign', term: 'Term', content: 'Content' }[key];
  }

  applyPreset(id: string): void {
    const preset = this.presets.find((p) => p.id === id);
    if (preset) this.form.utm = { source: preset.source, medium: preset.medium, campaign: preset.campaign, term: preset.term, content: preset.content };
  }

  savePreset(): void {
    const name = this.presetName.trim();
    if (!name) return;
    this.links.createUtmPreset({ name, ...this.form.utm }).subscribe({
      next: (preset) => {
        this.presets = [...this.presets, preset].sort((a, b) => a.name.localeCompare(b.name));
        this.presetName = '';
        this.cdr.markForCheck();
      },
      error: (err) => this.fail(err),
    });
  }

  toggleSplit(on: boolean): void {
    this.form.split = on;
    if (on && this.form.variants.length < 2) {
      const [a, b] = evenWeights(2);
      this.form.variants = [{ url: this.finalUrl, weight: a }, { url: '', weight: b }];
    }
  }

  addVariant(): void {
    const weights = evenWeights(this.form.variants.length + 1);
    this.form.variants = [...this.form.variants, { url: '', weight: 0 }].map((v, i) => ({ ...v, weight: weights[i] }));
  }

  removeVariant(index: number): void {
    const kept = this.form.variants.filter((_, i) => i !== index);
    const weights = evenWeights(kept.length);
    this.form.variants = kept.map((v, i) => ({ ...v, weight: weights[i] }));
  }

  setWeight(index: number, value: number): void {
    const weights = rebalance(this.form.variants.map((v) => v.weight), index, value);
    this.form.variants = this.form.variants.map((v, i) => ({ ...v, weight: weights[i] }));
  }

  trackByIndex(index: number): number {
    return index;
  }

  save(): void {
    const changes = buildChanges(this.link, this.form, this.can);
    if (this.link && Object.keys(changes).length === 0) return this.closed.emit();
    this.saving = true;
    this.error = this.aliasError = '';
    const request = this.link ? this.links.update(this.link.id, changes) : this.links.create(changes);
    request.subscribe({
      next: (link) => this.saved.emit(link),
      error: (err) => this.fail(err),
    });
  }

  private fail(err: HttpErrorResponse): void {
    this.saving = false;
    const message = apiError(err).message;
    if (err.status === 409 || /alias/i.test(message)) this.aliasError = message;
    else this.error = message;
    this.cdr.markForCheck();
  }
}
