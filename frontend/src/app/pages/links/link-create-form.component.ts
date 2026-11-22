import { Component, EventEmitter, Output } from '@angular/core';
import { Link, LinksService } from '../../links.service';
import { errorMessage, fromLocalInput } from './form-utils';

@Component({
  selector: 'app-link-create-form',
  templateUrl: './link-create-form.component.html',
})
export class LinkCreateFormComponent {
  @Output() created = new EventEmitter<Link>();

  url = '';
  alias = '';
  expiresAt = '';
  creating = false;
  error = '';

  constructor(private linksService: LinksService) {}

  create(): void {
    this.error = '';
    this.creating = true;
    this.linksService
      .create({ url: this.url.trim(), alias: this.alias.trim() || undefined, expiresAt: fromLocalInput(this.expiresAt) })
      .subscribe({
        next: (link) => {
          this.created.emit(link);
          this.url = '';
          this.alias = '';
          this.expiresAt = '';
          this.creating = false;
        },
        error: (err) => {
          this.error = errorMessage(err);
          this.creating = false;
        },
      });
  }
}
