import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { fetchProjectTickets, fetchTicketDetail } from './app/services/firebase-admin.server';

const browserDistFolder = join(import.meta.dirname, '../browser');
// The BACKLOG_PATH regex matches the /:projectId/backlog, /:projectId/kanban, and /:projectId/resolved routes.
const BACKLOG_PATH = /^\/([^/]+)\/(backlog|kanban|resolved)\/?$/;
// The TICKET_PATH regex matches the /:projectId/ticket/:ticketId route.
const TICKET_PATH = /^\/([^/]+)\/(ticket)\/([^/]+)\/?$/;

const app = express();
const angularApp = new AngularNodeAppEngine();

// Cap the pre-render Firestore fetches: they are awaited before every SSR
// render, so a slow/unreachable Firestore must degrade to a render without
// initial data (the client subscription takes over) instead of hanging the
// request — and piling up hung requests — on the VPS.
const SSR_FETCH_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${SSR_FETCH_TIMEOUT_MS}ms`)),
        SSR_FETCH_TIMEOUT_MS,
      ).unref();
    }),
  ]);
}

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 *
 * For the /:projectId/backlog route (the only one running RenderMode.Server,
 * see app.routes.server.ts) we fetch the backlog with Admin SDK privileges
 * *here*, before Angular even starts rendering, and pass it through as
 * REQUEST_CONTEXT — the only way to guarantee this Admin SDK call never
 * gets pulled into the browser bundle (see backlog-tickets.resolver.ts).
 */
app.use(async (req, res, next) => {
  const backlogPathMatch = req.path.match(BACKLOG_PATH);
  const ticketPathMatch = req.path.match(TICKET_PATH);
  let context: Record<string, unknown> = {};

  if (backlogPathMatch) {
    try {
      context = {
        initialProjectTickets: await withTimeout(fetchProjectTickets(backlogPathMatch[1]), 'SSR backlog fetch'),
      };
    } catch (error) {
      // SSR data-fetch failing shouldn't break the whole render — the
      // client-side Firestore subscription still takes over after hydration.
      console.error('SSR backlog fetch failed:', error);
    }
  }

  if (ticketPathMatch) {
    try {
      context = {
        initialTicketDetail: await withTimeout(
          fetchTicketDetail(ticketPathMatch[1], ticketPathMatch[3]),
          'SSR ticket fetch',
        ),
      };
    } catch (error) {
      console.error('SSR ticket fetch failed:', error);
    }
  }

  angularApp
    .handle(req, context)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
