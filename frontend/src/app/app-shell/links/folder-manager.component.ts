import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import type { Observable } from 'rxjs';
import { Folder, LinksService } from '../../links.service';
import { apiError } from '../../api-error';

/** Create / rename (Pro) and delete (any plan) folders. Emits `changed` so the page reloads. */
@Component({
  selector: 'app-folder-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-modal label="Manage folders" (closed)="closed.emit()">
      <h2 class="flex items-center gap-2 text-lg font-semibold">Folders <z-badge *ngIf="!canEdit" tone="pro" [locked]="true">Pro</z-badge></h2>
      <p *ngIf="!canEdit" class="mt-1 text-sm text-muted">On Free you can still delete folders you made while on Pro.</p>
      <ul class="mt-4 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
        <li *ngIf="folders.length === 0" class="px-4 py-6 text-center text-sm text-muted">No folders yet.</li>
        <li *ngFor="let f of folders" class="flex items-center gap-2 px-3 py-2">
          <ng-container *ngIf="renamingId === f.id; else row">
            <input zInput class="!py-1.5" [(ngModel)]="renameTo" [attr.aria-label]="'New name for ' + f.name" (keydown.enter)="rename(f)" />
            <button zButton size="sm" (click)="rename(f)">Save</button>
            <button zButton size="sm" variant="ghost" (click)="renamingId = null">Cancel</button>
          </ng-container>
          <ng-template #row>
            <z-icon name="folder" [size]="16" class="text-muted"></z-icon>
            <span class="flex-1 truncate text-sm">{{ f.name }}</span>
            <span class="text-xs text-muted">{{ f.linkCount }} links</span>
            <button *ngIf="canEdit" zButton size="sm" variant="ghost" class="!px-2" [attr.aria-label]="'Rename ' + f.name" (click)="renamingId = f.id; renameTo = f.name">
              <z-icon name="edit" [size]="14"></z-icon>
            </button>
            <button zButton size="sm" variant="ghost" class="!px-2 text-danger" [attr.aria-label]="'Delete ' + f.name" (click)="remove(f)">
              <z-icon name="trash" [size]="14"></z-icon>
            </button>
          </ng-template>
        </li>
      </ul>
      <form *ngIf="canEdit" class="mt-4 flex gap-2" (ngSubmit)="create()">
        <input name="newFolder" zInput placeholder="New folder name" maxlength="40" [(ngModel)]="newName" aria-label="New folder name" />
        <button zButton type="submit" [disabled]="!newName.trim()">Add</button>
      </form>
      <p *ngIf="error" role="alert" class="mt-3 text-sm text-danger">{{ error }}</p>
      <p class="mt-3 text-xs text-muted">Deleting a folder keeps its links.</p>
      <div class="mt-5 flex justify-end"><button zButton variant="secondary" (click)="closed.emit()">Done</button></div>
    </z-modal>
  `,
})
export class FolderManagerComponent {
  @Input() folders: Folder[] = [];
  @Input() canEdit = false;
  @Output() changed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  newName = '';
  renamingId: string | null = null;
  renameTo = '';
  error = '';

  constructor(private links: LinksService, private cdr: ChangeDetectorRef) {}

  create(): void {
    this.run(this.links.createFolder(this.newName.trim()), () => (this.newName = ''));
  }

  rename(folder: Folder): void {
    this.run(this.links.renameFolder(folder.id, this.renameTo.trim()), () => (this.renamingId = null));
  }

  remove(folder: Folder): void {
    this.run(this.links.deleteFolder(folder.id), () => undefined);
  }

  private run(request: Observable<unknown>, after: () => void): void {
    this.error = '';
    request.subscribe({
      next: () => {
        after();
        this.changed.emit();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = apiError(err).message;
        this.cdr.markForCheck();
      },
    });
  }
}
