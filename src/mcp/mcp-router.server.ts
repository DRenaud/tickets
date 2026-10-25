import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { PROJECTS } from '../app/data/tickets-seed';
import {
  CATEGORIES,
  NothingToRelease,
  PRIORITIES,
  PROJECT_IDS,
  SPRINT_STATUSES,
  STATUSES,
  createTicket,
  getSprint,
  getTicket,
  listTickets,
  releaseSprint,
  renameSprint,
  updateTicket,
} from './tickets.server';

const projectId = z.enum(PROJECT_IDS).describe('Project id');
const ticketId = z.string().min(1).describe('Firestore ticket id');

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/** Logs Firestore failures server-side instead of leaking their details to public clients. */
async function safely<T>(run: () => Promise<T>): Promise<T | ReturnType<typeof errorResult>> {
  try {
    return await run();
  } catch (error) {
    console.error('MCP tool failed:', error);
    return errorResult('Request failed, please retry later.');
  }
}

/** Hashed first so timingSafeEqual gets equal-length buffers whatever the client sends. */
function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Write access is a single shared secret (`MCP_ADMIN_TOKEN`, sent as
 * `Authorization: Bearer …`). Unset, the endpoint stays read-only.
 */
function bearerToken(req: Request): string | undefined {
  return req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
}

function hasValidToken(req: Request): boolean {
  const expected = process.env['MCP_ADMIN_TOKEN'];
  const token = bearerToken(req);
  return !!expected && !!token && timingSafeEqual(sha256(token), sha256(expected));
}

/**
 * Rejects a request that presents a token which isn't valid, instead of
 * silently serving it read-only. An empty token (e.g. an unset env var in
 * .mcp.json) counts as anonymous.
 */
function rejectBadCredentials(req: Request, res: Response, next: NextFunction): void {
  if (bearerToken(req) && !hasValidToken(req)) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Invalid token.' }, id: null });
    return;
  }
  next();
}

/**
 * Builds the FastTicket MCP server. The write tools (tickets, sprint,
 * release) are only registered for authenticated requests (`canWrite`), so
 * public clients can't see or call them.
 */
function createMcpServer(canWrite: boolean): McpServer {
  const server = new McpServer({ name: 'fast-ticket', version: '0.1.0' });

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'Lists the FastTicket projects (id + label).',
      annotations: { readOnlyHint: true },
    },
    async () => json(PROJECTS),
  );

  server.registerTool(
    'list_tickets',
    {
      title: 'List tickets',
      description:
        'Lists the tickets of a project, sorted like the app (upvotes desc, then priority). ' +
        'Statuses: backlog → todo → inprogress → done (sprint) → resolved (released).',
      inputSchema: {
        projectId,
        status: z.enum(STATUSES).optional(),
        priority: z.enum(PRIORITIES).optional(),
        category: z.enum(CATEGORIES).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, ...filters }) => safely(async () => json(await listTickets(projectId, filters))),
  );

  server.registerTool(
    'get_ticket',
    {
      title: 'Get ticket',
      description: 'Returns a ticket with its full description and comments.',
      inputSchema: { projectId, ticketId },
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, ticketId }) =>
      safely(async () => {
        const ticket = await getTicket(projectId, ticketId);
        return ticket ? json(ticket) : errorResult(`Ticket ${ticketId} not found.`);
      }),
  );

  if (canWrite) registerWriteTools(server);

  return server;
}

function registerWriteTools(server: McpServer): void {
  server.registerTool(
    'create_ticket',
    {
      title: 'Create ticket',
      description: 'Creates a ticket in the backlog of a project.',
      inputSchema: {
        projectId,
        title: z.string().trim().min(1).max(200),
        description: z.string().max(5000).optional(),
        priority: z.enum(PRIORITIES).default('medium'),
        category: z.enum(CATEGORIES).default('idea'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ projectId, ...input }) => safely(async () => json(await createTicket(projectId, input))),
  );

  server.registerTool(
    'update_ticket',
    {
      title: 'Update ticket',
      description:
        'Updates the given fields of a ticket. `status` moves it between backlog, todo, inprogress and done ' +
        '(`resolved` is only reached through release_sprint).',
      inputSchema: {
        projectId,
        ticketId,
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().max(5000).optional(),
        status: z.enum(SPRINT_STATUSES).optional(),
        priority: z.enum(PRIORITIES).optional(),
        category: z.enum(CATEGORIES).optional(),
        prLink: z.string().max(500).optional(),
        bugReportLinks: z.array(z.string().max(500)).max(50).optional(),
        timeSpentMinutes: z.number().int().min(0).optional(),
        locked: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ projectId, ticketId, ...changes }) =>
      safely(async () => {
        if (Object.values(changes).every((v) => v === undefined)) return errorResult('No field to update.');
        const ticket = await updateTicket(projectId, ticketId, changes);
        return ticket ? json(ticket) : errorResult(`Ticket ${ticketId} not found.`);
      }),
  );

  server.registerTool(
    'get_sprint',
    {
      title: 'Get sprint',
      description: 'Returns the current sprint (number, name) and the ticket count per status.',
      inputSchema: { projectId },
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) => safely(async () => json(await getSprint(projectId))),
  );

  server.registerTool(
    'rename_sprint',
    {
      title: 'Rename sprint',
      description: 'Renames the current sprint.',
      inputSchema: { projectId, sprintName: z.string().trim().min(1).max(100) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ projectId, sprintName }) =>
      safely(async () => {
        await renameSprint(projectId, sprintName);
        return json({ sprintName });
      }),
  );

  server.registerTool(
    'release_sprint',
    {
      title: 'Release sprint',
      description:
        'Releases the sprint: every `done` ticket becomes `resolved` with the given version, then the project ' +
        'moves to the next sprint. Cannot be undone by this server.',
      inputSchema: {
        projectId,
        version: z.string().trim().min(1).max(50).describe('e.g. v1.4.0'),
        nextSprintName: z.string().trim().min(1).max(100).optional().describe('Defaults to "Sprint N+1"'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ projectId, version, nextSprintName }) =>
      safely(async () => {
        try {
          return json(await releaseSprint(projectId, version, nextSprintName));
        } catch (error) {
          if (error instanceof NothingToRelease) return errorResult(error.message);
          throw error;
        }
      }),
  );
}

function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
}

/**
 * MCP endpoint (Streamable HTTP, stateless: a fresh server + transport per
 * request, no session to keep in memory). Reads are public; writes need the
 * bearer token. Every tool call hits Firestore, so requests are rate-limited
 * per client IP.
 */
export const mcpRouter = Router();

mcpRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { jsonrpc: '2.0', error: { code: -32000, message: 'Too many requests, retry later.' }, id: null },
  }),
);

mcpRouter.post('/', rejectBadCredentials, express.json(), async (req, res) => {
  const server = createMcpServer(hasValidToken(req));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error.' }, id: null });
    }
  }
});

// Stateless server: no SSE stream to open (GET) nor session to end (DELETE).
mcpRouter.get('/', methodNotAllowed);
mcpRouter.delete('/', methodNotAllowed);
