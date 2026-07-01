import { Component, effect, inject, input } from '@angular/core';
import { AppHeader } from '../../components/app-header/app-header';
import { BacklogView } from '../../components/backlog-view/backlog-view';
import { KanbanView } from '../../components/kanban-view/kanban-view';
import { NewTicketModal } from '../../components/new-ticket-modal/new-ticket-modal';
import { ResolvedView } from '../../components/resolved-view/resolved-view';
import { StatsBar } from '../../components/stats-bar/stats-bar';
import { TabsNav } from '../../components/tabs-nav/tabs-nav';
import { TicketPicker } from '../../components/ticket-picker/ticket-picker';
import { ToastNotification } from '../../components/toast-notification/toast-notification';
import { ProjectId } from '../../models/ticket.model';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-ticket-board-page',
  imports: [
    AppHeader,
    StatsBar,
    TabsNav,
    BacklogView,
    KanbanView,
    ResolvedView,
    TicketPicker,
    NewTicketModal,
    ToastNotification,
  ],
  templateUrl: './ticket-board-page.html',
  styleUrl: './ticket-board-page.css',
})
export class TicketBoardPage {
  protected readonly store = inject(TicketStore);

  readonly projectId = input.required<ProjectId>();

  constructor() {
    effect(() => this.store.switchProject(this.projectId()));
  }
}
