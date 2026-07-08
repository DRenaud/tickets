import { CanMatchFn, Routes } from '@angular/router';
import { authReadyGuard } from './guards/auth.guard';
import { projectTicketResolver } from './resolvers/project-tickets.resolver';
import { ticketDetailResolver } from './resolvers/ticket-details.resolver';

const VALID_PROJECT_IDS = new Set(['alveola', 'ludistes']);

const isValidProjectId: CanMatchFn = (_route, segments) => VALID_PROJECT_IDS.has(segments[0]?.path);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'alveola' },
  {
    path: ':projectId',
    canMatch: [isValidProjectId],
    canActivate: [authReadyGuard],
    loadComponent: () => import('./pages/ticket-board-page/ticket-board-page').then((m) => m.TicketBoardPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'backlog' },
      {
        path: 'backlog',
        resolve: { initialTickets: projectTicketResolver },
        loadComponent: () => import('./components/backlog-view/backlog-view').then((m) => m.BacklogView),
      },
      {
        path: 'kanban',
        resolve: { initialTickets: projectTicketResolver },
        loadComponent: () => import('./components/kanban-view/kanban-view').then((m) => m.KanbanView),
      },
      {
        path: 'resolved',
        resolve: { initialTickets: projectTicketResolver },
        loadComponent: () => import('./components/resolved-view/resolved-view').then((m) => m.ResolvedView),
      },
      {
        path: 'ticket/:ticketId',
        resolve: { initialTicketDetail: ticketDetailResolver },
        loadComponent: () =>
          import('./components/ticket-detail-view/ticket-detail-view').then((m) => m.TicketDetailView),
      },
    ],
  },
  { path: '**', redirectTo: 'alveola' },
];
