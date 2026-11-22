import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import type { Bio, BioTheme } from '../../api-types';
import { BioService } from '../../bio.service';
import { Link, LinksService } from '../../links.service';
import { MeService } from '../../me.service';
import { ToastService } from '../../ui/toast.service';
import { apiError } from '../../api-error';

const MAX_LINKS = 20;
const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

@Component({
  selector: 'app-bio-editor',
  templateUrl: './bio-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BioEditorComponent implements OnInit {
  readonly themes: { id: BioTheme; label: string; swatch: string }[] = [
    { id: 'violet', label: 'Violet', swatch: 'bg-gradient-to-br from-[#7c3aed] to-[#3730a3]' },
    { id: 'midnight', label: 'Midnight', swatch: 'bg-[#07060b] border border-[#27233a]' },
    { id: 'light', label: 'Light', swatch: 'bg-[#fafafe] border border-[#e6e4f2]' },
  ];
  readonly maxLinks = MAX_LINKS;

  loading = true;
  published: Bio | null = null; // what's live
  form: Bio = { handle: '', title: '', description: '', theme: 'violet', links: [] };
  myLinks: Link[] = [];
  addLinkId = '';
  saving = false;
  error = '';
  handleError = '';
  confirmingDelete = false;

  constructor(private bio: BioService, private links: LinksService, public me: MeService, private toast: ToastService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    forkJoin({ bio: this.bio.mine(), links: this.links.list() }).subscribe({
      next: ({ bio, links }) => {
        this.published = bio;
        this.myLinks = links;
        if (bio) this.form = { ...bio, links: bio.links.map((l) => ({ ...l })) };
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => this.fail(err),
    });
  }

  get publicUrl(): string {
    return `${window.location.origin}/@${this.published?.handle ?? this.form.handle}`;
  }

  get handleHint(): string {
    if (!this.form.handle) return '3–30 lowercase letters, digits or _.';
    return HANDLE_PATTERN.test(this.form.handle) ? `Your page: ${window.location.origin}/@${this.form.handle}` : 'Use 3–30 lowercase letters, digits or _.';
  }

  /** Links not already on the page, for the "add" picker. */
  get available(): Link[] {
    const used = new Set(this.form.links.map((l) => l.linkId));
    return this.myLinks.filter((l) => !used.has(l.id));
  }

  /** Preview rows: labels only, no hrefs (preview taps shouldn't count as clicks). */
  get preview(): { label: string; href: null }[] {
    return this.form.links.map((l) => ({ label: l.label || this.codeOf(l.linkId), href: null }));
  }

  codeOf(linkId: string): string {
    return this.myLinks.find((l) => l.id === linkId)?.code ?? 'deleted link';
  }

  normalizeHandle(): void {
    this.form.handle = this.form.handle.trim().toLowerCase();
  }

  addLink(): void {
    const link = this.myLinks.find((l) => l.id === this.addLinkId);
    if (!link || this.form.links.length >= MAX_LINKS) return;
    this.form.links = [...this.form.links, { linkId: link.id, label: link.code }];
    this.addLinkId = '';
  }

  move(index: number, by: -1 | 1): void {
    const links = [...this.form.links];
    const target = index + by;
    if (target < 0 || target >= links.length) return;
    [links[index], links[target]] = [links[target], links[index]];
    this.form.links = links;
  }

  removeLink(index: number): void {
    this.form.links = this.form.links.filter((_, i) => i !== index);
  }

  save(): void {
    this.saving = true;
    this.error = this.handleError = '';
    const body: Bio = { ...this.form, handle: this.form.handle.trim().toLowerCase(), links: this.form.links.map((l) => ({ ...l, label: l.label.trim() })) };
    this.bio.save(body).subscribe({
      next: (saved) => {
        this.published = saved;
        this.saving = false;
        this.toast.show('Page published');
        this.me.refresh(); // bioHandle
        this.cdr.markForCheck();
      },
      error: (err) => this.fail(err),
    });
  }

  remove(): void {
    this.bio.remove().subscribe({
      next: () => {
        this.published = null;
        this.confirmingDelete = false;
        this.toast.show('Page taken down');
        this.me.refresh();
        this.cdr.markForCheck();
      },
      error: (err) => this.fail(err),
    });
  }

  copyUrl(): void {
    navigator.clipboard.writeText(this.publicUrl).then(() => this.toast.show('Page link copied'), () => this.toast.show('Could not copy'));
  }

  private fail(err: HttpErrorResponse): void {
    this.loading = this.saving = false;
    const message = apiError(err).message;
    if (err.error?.code === 'HANDLE_TAKEN' || /handle/i.test(message)) this.handleError = message;
    else this.error = message;
    this.cdr.markForCheck();
  }
}
