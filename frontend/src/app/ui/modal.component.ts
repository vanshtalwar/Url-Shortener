import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { trapTab } from './focus-trap';

/**
 * Accessible dialog: role=dialog + aria-modal, Escape and backdrop close it, focus moves in on open and
 * returns to where it was on close. Render it with *ngIf.
 */
@Component({
  selector: 'z-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center" (click)="closed.emit()">
      <div role="dialog" aria-modal="true" [attr.aria-label]="label" tabindex="-1"
           class="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-soft outline-none" (click)="$event.stopPropagation()">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  @Input() label = '';
  @Output() closed = new EventEmitter<void>();
  private readonly previousFocus = document.activeElement as HTMLElement | null;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const dialog = this.host.nativeElement.querySelector<HTMLElement>('[role=dialog]');
    const first = dialog?.querySelector<HTMLElement>('a[href], button:not([disabled]), input, select, textarea');
    (first ?? dialog)?.focus();
  }

  ngOnDestroy(): void {
    this.previousFocus?.focus?.();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  /** Tab stays inside the dialog while it's open. */
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const dialog = this.host.nativeElement.querySelector<HTMLElement>('[role=dialog]');
    if (dialog) trapTab(dialog, event);
  }
}
