import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PriorityFilter } from '../../models/ticket.model';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-backlog-view',
  imports: [TranslocoPipe],
  templateUrl: './backlog-view.html',
  styleUrl: './backlog-view.css',
})
export class BacklogView {
  protected readonly store = inject(TicketStore);

  protected readonly filters: { key: PriorityFilter; labelKey: string }[] = [
    { key: 'all', labelKey: 'priority.all' },
    { key: 'high', labelKey: 'priority.high' },
    { key: 'medium', labelKey: 'priority.medium' },
    { key: 'low', labelKey: 'priority.low' },
  ];
}
