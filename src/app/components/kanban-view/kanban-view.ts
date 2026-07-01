import { Component, inject } from '@angular/core';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-kanban-view',
  templateUrl: './kanban-view.html',
  styleUrl: './kanban-view.css',
})
export class KanbanView {
  protected readonly store = inject(TicketStore);
}
