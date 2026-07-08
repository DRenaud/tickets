import { CanMatchFn, Routes } from '@angular/router';
import { authReadyGuard } from './guards/auth.guard';

const VALID_PROJECT_IDS = new Set(['alveola', 'ludistes']);

const isValidProjectId: CanMatchFn = (_route, segments) => VALID_PROJECT_IDS.has(segments[0]?.path);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'alveola' },
  {
    path: ':projectId',
    canMatch: [isValidProjectId],
    canActivate: [authReadyGuard],
    loadComponent: () => import('./pages/ticket-board-page/ticket-board-page').then((m) => m.TicketBoardPage),
  },
  { path: '**', redirectTo: 'alveola' },
];
