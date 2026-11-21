import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toDataURL } from 'qrcode';
import { Link, LinksService, shortUrl } from '../../links.service';

/** ISO string → value for <input type="datetime-local"> in the user's timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value → ISO string, or null when empty. */
function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function errorMessage(err: HttpErrorResponse): string {
  return err.error?.error ?? 'Something went wrong. Please try again.';
}

@Component({
  selector: 'app-links',
  templateUrl: './links.component.html',
})
export class LinksComponent implements OnInit {
  links: Link[] = [];
  loading = true;
  error = '';

  // Create form
  url = '';
  alias = '';
  expiresAt = '';
  creating = false;

  // Inline edit (one row at a time)
  editingId: string | null = null;
  edit = { url: '', alias: '', expiresAt: '' };

  // QR panel
  qr: { code: string; dataUrl: string } | null = null;

  shortUrl = shortUrl;

  constructor(private linksService: LinksService) {}

  ngOnInit(): void {
    this.linksService.list().subscribe({
      next: (links) => {
        this.links = links;
        this.loading = false;
      },
      error: (err) => {
        this.error = errorMessage(err);
        this.loading = false;
      },
    });
  }

  isExpired(link: Link): boolean {
    return link.expiresAt !== null && Date.parse(link.expiresAt) <= Date.now();
  }

  create(): void {
    this.error = '';
    this.creating = true;
    this.linksService
      .create({ url: this.url.trim(), alias: this.alias.trim() || undefined, expiresAt: fromLocalInput(this.expiresAt) })
      .subscribe({
        next: (link) => {
          this.links = [link, ...this.links];
          this.url = this.alias = this.expiresAt = '';
          this.creating = false;
        },
        error: (err) => {
          this.error = errorMessage(err);
          this.creating = false;
        },
      });
  }

  startEdit(link: Link): void {
    this.editingId = link.id;
    this.edit = { url: link.url, alias: link.code, expiresAt: toLocalInput(link.expiresAt) };
  }

  saveEdit(link: Link): void {
    const alias = this.edit.alias.trim();
    if (alias !== link.code && !confirm(`${shortUrl(link.code)} will stop working. Continue?`)) return;

    this.error = '';
    this.linksService
      .update(link.id, { url: this.edit.url.trim(), alias, expiresAt: fromLocalInput(this.edit.expiresAt) })
      .subscribe({
        next: (updated) => {
          this.links = this.links.map((l) => (l.id === updated.id ? updated : l));
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
        this.links = this.links.filter((l) => l.id !== link.id);
        if (this.qr?.code === link.code) this.qr = null;
      },
      error: (err) => (this.error = errorMessage(err)),
    });
  }

  copy(link: Link): void {
    navigator.clipboard.writeText(shortUrl(link.code));
  }

  async showQr(link: Link): Promise<void> {
    this.qr = { code: link.code, dataUrl: await toDataURL(shortUrl(link.code), { width: 256, margin: 2 }) };
  }
}
