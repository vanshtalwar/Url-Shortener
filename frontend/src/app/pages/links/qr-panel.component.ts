import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { toDataURL } from 'qrcode';
import { shortUrl } from '../../links.service';

const QR_SIZE_PX = 256;

@Component({
  selector: 'app-qr-panel',
  templateUrl: './qr-panel.component.html',
})
export class QrPanelComponent implements OnChanges {
  @Input() code = '';
  @Output() closed = new EventEmitter<void>();

  readonly size = QR_SIZE_PX;
  dataUrl = '';
  error = '';
  shortUrl = shortUrl;

  async ngOnChanges(): Promise<void> {
    const code = this.code;
    this.dataUrl = '';
    this.error = '';
    try {
      const dataUrl = await toDataURL(shortUrl(code), { width: QR_SIZE_PX, margin: 2 });
      if (code === this.code) this.dataUrl = dataUrl; // ignore results for a code that's no longer shown
    } catch {
      this.error = 'Could not generate the QR code.';
    }
  }
}
