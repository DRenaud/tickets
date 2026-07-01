import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: ':projectId',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => [{ projectId: 'alveola' }, { projectId: 'ludistes' }],
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
