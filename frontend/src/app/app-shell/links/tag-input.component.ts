import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

const MAX_TAGS = 10;
const MAX_LENGTH = 24;

/** Chips + text box. Enter or comma adds a tag (lowercased, de-duplicated); Backspace on empty removes the last. */
@Component({
  selector: 'app-tag-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2 py-1.5"
         [class.opacity-60]="disabled" (click)="box.focus()">
      <span *ngFor="let tag of tags" class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs">
        {{ tag }}
        <button *ngIf="!disabled" type="button" class="text-muted hover:text-ink" [attr.aria-label]="'Remove tag ' + tag" (click)="remove(tag)">
          <z-icon name="x" [size]="12"></z-icon>
        </button>
      </span>
      <input #box [id]="inputId" type="text" class="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
             [placeholder]="tags.length >= max ? 'Tag limit reached' : 'Add a tag…'" [disabled]="disabled || tags.length >= max"
             [maxLength]="maxLength" (keydown)="onKey($event, box)" (blur)="add(box)" />
    </div>
  `,
})
export class TagInputComponent {
  @Input() tags: string[] = [];
  @Input() disabled = false;
  @Input() inputId = 'tags';
  @Output() tagsChange = new EventEmitter<string[]>();
  readonly max = MAX_TAGS;
  readonly maxLength = MAX_LENGTH;

  onKey(event: KeyboardEvent, box: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.add(box);
    } else if (event.key === 'Backspace' && !box.value && this.tags.length) {
      this.tagsChange.emit(this.tags.slice(0, -1));
    }
  }

  add(box: HTMLInputElement): void {
    const tag = box.value.trim().toLowerCase();
    box.value = '';
    if (tag && !this.tags.includes(tag) && this.tags.length < MAX_TAGS) this.tagsChange.emit([...this.tags, tag]);
  }

  remove(tag: string): void {
    this.tagsChange.emit(this.tags.filter((t) => t !== tag));
  }
}
