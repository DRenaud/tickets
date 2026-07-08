import { Component, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { AppHeader } from '../../components/app-header/app-header';
import { LoginModal } from '../../components/login-modal/login-modal';
import { NewTicketModal } from '../../components/new-ticket-modal/new-ticket-modal';
import { ReleaseModal } from '../../components/release-modal/release-modal';
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
    RouterOutlet,
    TicketPicker,
    NewTicketModal,
    ReleaseModal,
    LoginModal,
    ToastNotification,
    TranslocoPipe,
  ],
  templateUrl: './ticket-board-page.html',
  styleUrl: './ticket-board-page.css',
})
export class TicketBoardPage {
  protected readonly store = inject(TicketStore);
  private readonly router = inject(Router);

  readonly projectId = input.required<ProjectId>();

  protected readonly isTicketDetailRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url.includes('/ticket/')),
    ),
    { initialValue: this.router.url.includes('/ticket/') },
  );

  constructor() {
    effect(() => this.store.switchProject(this.projectId()));
  }
}
