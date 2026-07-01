import { Component, inject } from '@angular/core';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-ticket-picker',
  templateUrl: './ticket-picker.html',
  styleUrl: './ticket-picker.css',
})
export class TicketPicker {
  protected readonly store = inject(TicketStore);

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
