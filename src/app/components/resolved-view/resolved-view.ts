import { Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketStore } from '../../services/ticket-store';
import { SerializedTicket } from '../../models/ticket.model';

@Component({
  selector: 'app-resolved-view',
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './resolved-view.html',
  styleUrl: './resolved-view.css',
})
export class ResolvedView {
  readonly initialTickets = input<SerializedTicket[] | null>(null);

  protected readonly store = inject(TicketStore);

  constructor() {
    effect(() => {
      const tickets = this.initialTickets();
      if (tickets) this.store.seedTickets(tickets);
    });
  }
}
