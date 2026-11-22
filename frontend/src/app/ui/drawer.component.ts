import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { trapTab } from './focus-trap';

/**
 * Right-hand panel for longer forms. Same behaviour as the modal: role=dialog + aria-modal, Escape and backdrop
 * close it, focus moves in on open and returns on close; the page behind doesn't scroll. Render with *ngIf.
 */
@Component({
  selector: 'z-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" (click)="closed.emit()">
      <section role="dialog" aria-modal="true" [attr.aria-label]="label" tabindex="-1"
               class="flex h-full w-full max-w-xl flex-col border-l border-line bg-surface shadow-soft outline-none" (click)="$event.stopPropagation()">
        <header class="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 class="text-lg font-semibold">{{ label }}</h2>
          <button zButton type="button" variant="ghost" size="sm" class="!px-2" aria-label="Close" (click)="closed.emit()"><z-icon name="x"></z-icon></button>
        </header>
        <div class="flex-1 overflow-y-auto px-6 py-5"><ng-content></ng-content></div>
        <footer class="border-t border-line px-6 py-4"><ng-content select="[drawerFooter]"></ng-content></footer>
      </section>
    </div>
  `,
})
export class DrawerComponent implements AfterViewInit, OnDestroy {
  @Input() label = '';
  @Output() closed = new EventEmitter<void>();
  private readonly previousFocus = document.activeElement as HTMLElement | null;
  private readonly previousOverflow = document.body.style.overflow;

  constructor(private host: ElementRef<HTMLElement>) {
    document.body.style.overflow = 'hidden';
  }

  ngAfterViewInit(): void {
    const panel = this.host.nativeElement.querySelector<HTMLElement>('[role=dialog]');
    const first = panel?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea');
    (first ?? panel)?.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
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
