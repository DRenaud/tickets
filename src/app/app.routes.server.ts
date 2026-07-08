import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: ':projectId/backlog',
    renderMode: RenderMode.Server,
  },
  {
    path: ':projectId/kanban',
    renderMode: RenderMode.Server,
  },
  {
    path: ':projectId/resolved',
    renderMode: RenderMode.Server,
  },
  {
    path: ':projectId/ticket/:ticketId',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
