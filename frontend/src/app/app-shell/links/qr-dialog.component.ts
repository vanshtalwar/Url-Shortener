import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { toDataURL } from 'qrcode';
import { shortUrl } from '../../links.service';

const QR_SIZE_PX = 512; // downloaded PNG size; shown smaller

/** QR code for a short link in a modal, with PNG download. */
@Component({
  selector: 'app-qr-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-modal [label]="'QR code for ' + shortUrl(code)" (closed)="closed.emit()">
      <h2 class="text-lg font-semibold">QR code</h2>
      <p class="mt-1 break-all font-mono text-sm text-muted">{{ shortUrl(code) }}</p>
      <div class="mt-5 flex justify-center rounded-2xl bg-white p-4">
        <img *ngIf="dataUrl; else pending" [src]="dataUrl" [alt]="'QR code for ' + shortUrl(code)" width="240" height="240" />
        <ng-template #pending><div class="h-60 w-60 animate-pulse rounded-xl bg-neutral-200" aria-hidden="true"></div></ng-template>
      </div>
      <p *ngIf="error" role="alert" class="mt-3 text-sm text-danger">{{ error }}</p>
      <p class="mt-3 text-xs text-muted">Scans count as clicks. Print it at least 2 cm wide with a white margin.</p>
      <div class="mt-6 flex justify-end gap-2">
        <button zButton variant="ghost" (click)="closed.emit()">Close</button>
        <a *ngIf="dataUrl" zButton [href]="dataUrl" [attr.download]="code + '-qr.png'">Download PNG</a>
      </div>
    </z-modal>
  `,
})
export class QrDialogComponent implements OnChanges {
  @Input() code = '';
  @Output() closed = new EventEmitter<void>();
  dataUrl = '';
  error = '';
  readonly shortUrl = shortUrl;

  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnChanges(): Promise<void> {
    const code = this.code;
    this.dataUrl = this.error = '';
    try {
      const dataUrl = await toDataURL(shortUrl(code), { width: QR_SIZE_PX, margin: 2 });
      if (code === this.code) this.dataUrl = dataUrl; // ignore results for a code no longer shown
    } catch {
      this.error = 'Could not generate the QR code.';
    }
    this.cdr.markForCheck();
  }
}
