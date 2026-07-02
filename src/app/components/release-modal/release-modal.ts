import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-release-modal',
  imports: [TranslocoPipe],
  templateUrl: './release-modal.html',
  styleUrl: './release-modal.css',
})
export class ReleaseModal {
  protected readonly store = inject(TicketStore);

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
