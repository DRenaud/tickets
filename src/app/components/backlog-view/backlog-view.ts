import { Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PriorityFilter, SerializedTicket } from '../../models/ticket.model';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-backlog-view',
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './backlog-view.html',
  styleUrl: './backlog-view.css',
})
export class BacklogView {
  protected readonly store = inject(TicketStore);

  // Bound from the route resolver (see backlog-tickets.resolver.ts) via
  // withComponentInputBinding() — same mechanism as projectId/ticketId.
  readonly initialTickets = input<SerializedTicket[] | null>(null);

  constructor() {
    effect(() => {
      const tickets = this.initialTickets();
      if (tickets) this.store.seedTickets(tickets);
    });
  }

  protected readonly filters: { key: PriorityFilter; labelKey: string }[] = [
    { key: 'all', labelKey: 'priority.all' },
    { key: 'high', labelKey: 'priority.high' },
    { key: 'medium', labelKey: 'priority.medium' },
    { key: 'low', labelKey: 'priority.low' },
  ];
}
