import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tab } from '../../models/ticket.model';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-tabs-nav',
  imports: [TranslocoPipe],
  templateUrl: './tabs-nav.html',
  styleUrl: './tabs-nav.css',
})
export class TabsNav {
  protected readonly store = inject(TicketStore);

  protected readonly tabs: { key: Tab; labelKey: string }[] = [
    { key: 'backlog', labelKey: 'tabs.backlog' },
    { key: 'kanban', labelKey: 'tabs.kanban' },
    { key: 'resolved', labelKey: 'tabs.resolved' },
  ];
}
