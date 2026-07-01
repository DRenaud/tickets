import { Component, inject } from '@angular/core';
import { PriorityFilter } from '../../models/ticket.model';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-backlog-view',
  templateUrl: './backlog-view.html',
  styleUrl: './backlog-view.css',
})
export class BacklogView {
  protected readonly store = inject(TicketStore);

  protected readonly filters: { key: PriorityFilter; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'high', label: 'Haute' },
    { key: 'medium', label: 'Moyenne' },
    { key: 'low', label: 'Basse' },
  ];
}
