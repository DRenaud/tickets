import { Component, inject } from '@angular/core';
import { Tab } from '../../models/ticket.model';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-tabs-nav',
  templateUrl: './tabs-nav.html',
  styleUrl: './tabs-nav.css',
})
export class TabsNav {
  protected readonly store = inject(TicketStore);

  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'backlog', label: 'Backlog' },
    { key: 'kanban', label: 'Kanban' },
    { key: 'resolved', label: 'Résolus' },
  ];
}
