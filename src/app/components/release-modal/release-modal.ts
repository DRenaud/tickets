import { Component, inject } from '@angular/core';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-release-modal',
  templateUrl: './release-modal.html',
  styleUrl: './release-modal.css',
})
export class ReleaseModal {
  protected readonly store = inject(TicketStore);

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
