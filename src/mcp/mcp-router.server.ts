import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { PROJECTS } from '../app/data/tickets-seed';
import { CATEGORIES, PRIORITIES, PROJECT_IDS, STATUSES, getTicket, listTickets } from './tickets.server';

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
    return errorResult('Failed to read tickets, please retry later.');
  }
}

/**
 * Builds the FastTicket MCP server. Read-only on purpose: /mcp is public and
 * has no auth, so it must never expose a tool that writes to Firestore.
 */
function createMcpServer(): McpServer {
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

  return server;
}

function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
}

/**
 * Public, unauthenticated MCP endpoint (Streamable HTTP, stateless: a fresh
 * server + transport per request, no session to keep in memory). Every tool
 * call reads Firestore, so requests are rate-limited per client IP.
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

mcpRouter.post('/', express.json(), async (req, res) => {
  const server = createMcpServer();
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
