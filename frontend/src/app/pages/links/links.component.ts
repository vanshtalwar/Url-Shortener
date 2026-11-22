import { Component, OnDestroy, OnInit } from '@angular/core';
import { Link, LinkInput, LinksService, isExpired, shortUrl } from '../../links.service';
import { errorMessage, fromLocalInput, toLocalInput } from './form-utils';

const COPIED_FEEDBACK_MS = 2000;

/** The list of my links, with inline editing, copy, QR and delete. */
@Component({
  selector: 'app-links',
  templateUrl: './links.component.html',
})
export class LinksComponent implements OnInit, OnDestroy {
  links: Link[] = [];
  loading = true;
  error = '';
  now = Date.now(); // refreshed whenever the list changes; used to show "Expired"

  // Inline edit (one row at a time)
  editingId: string | null = null;
  editForm = { url: '', alias: '', expiresAt: '' };

  qrCode: string | null = null;
  copiedId: string | null = null;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  readonly shortUrl = shortUrl;
  readonly isExpired = isExpired;

  constructor(private linksService: LinksService) {}

  ngOnInit(): void {
    this.linksService.list().subscribe({
      next: (links) => {
        this.setLinks(links);
        this.loading = false;
      },
      error: (err) => {
        this.error = errorMessage(err);
        this.loading = false;
      },
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
  }

  trackById(_index: number, link: Link): string {
    return link.id;
  }

  onCreated(link: Link): void {
    this.setLinks([link, ...this.links]);
  }

  startEdit(link: Link): void {
    this.editingId = link.id;
    this.editForm = { url: link.url, alias: link.code, expiresAt: toLocalInput(link.expiresAt) };
  }

  saveEdit(link: Link): void {
    const changes = this.changedFields(link);
    if (Object.keys(changes).length === 0) {
      this.editingId = null;
      return;
    }
    if (changes.alias !== undefined && !confirm(`${shortUrl(link.code)} will stop working. Continue?`)) return;

    this.error = '';
    this.linksService.update(link.id, changes).subscribe({
      next: (updated) => {
        this.setLinks(this.links.map((l) => (l.id === updated.id ? updated : l)));
        this.editingId = null;
      },
      error: (err) => (this.error = errorMessage(err)),
    });
  }

  remove(link: Link): void {
    if (!confirm(`Delete ${shortUrl(link.code)} and all its click data?`)) return;
    this.error = '';
    this.linksService.remove(link.id).subscribe({
      next: () => {
        this.setLinks(this.links.filter((l) => l.id !== link.id));
        if (this.qrCode === link.code) this.qrCode = null;
      },
      error: (err) => (this.error = errorMessage(err)),
    });
  }

  copy(link: Link): void {
    navigator.clipboard.writeText(shortUrl(link.code)).then(
      () => {
        this.copiedId = link.id;
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => (this.copiedId = null), COPIED_FEEDBACK_MS);
      },
      () => (this.error = 'Could not copy to the clipboard.'),
    );
  }

  /** Only what the user actually changed, so untouched fields (e.g. a past expiry) aren't re-validated. */
  private changedFields(link: Link): LinkInput {
    const url = this.editForm.url.trim();
    const alias = this.editForm.alias.trim();
    const expiryChanged = this.editForm.expiresAt !== toLocalInput(link.expiresAt);
    return {
      ...(url !== link.url ? { url } : {}),
      ...(alias !== link.code ? { alias } : {}),
      ...(expiryChanged ? { expiresAt: fromLocalInput(this.editForm.expiresAt) } : {}),
    };
  }

  private setLinks(links: Link[]): void {
    this.links = links;
    this.now = Date.now();
  }
}
