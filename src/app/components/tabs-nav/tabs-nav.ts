import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tab } from '../../models/ticket.model';

@Component({
  selector: 'app-tabs-nav',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  templateUrl: './tabs-nav.html',
  styleUrl: './tabs-nav.css',
})
export class TabsNav {
  protected readonly tabs: { key: Tab; labelKey: string }[] = [
    { key: 'backlog', labelKey: 'tabs.backlog' },
    { key: 'kanban', labelKey: 'tabs.kanban' },
    { key: 'resolved', labelKey: 'tabs.resolved' },
  ];
}
