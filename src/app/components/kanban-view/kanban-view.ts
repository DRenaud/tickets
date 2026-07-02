import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-kanban-view',
  imports: [TranslocoPipe],
  templateUrl: './kanban-view.html',
  styleUrl: './kanban-view.css',
})
export class KanbanView {
  protected readonly store = inject(TicketStore);
}
