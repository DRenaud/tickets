#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  CATEGORIES,
  PRIORITIES,
  PROJECT_IDS,
  PROJECT_LABELS,
  STATUSES,
  getTicket,
  listTickets,
} from './tickets.ts';

const projectId = z.enum(PROJECT_IDS).describe('Project id');
const ticketId = z.string().min(1).describe('Firestore ticket id');

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function notFound(id: string) {
  return { content: [{ type: 'text' as const, text: `Ticket ${id} not found.` }], isError: true };
}

// Read-only on purpose: the server is meant to be usable without auth, so
// it must never expose a tool that writes to Firestore.
const server = new McpServer({ name: 'fast-ticket', version: '0.1.0' });

server.registerTool(
  'list_projects',
  {
    title: 'List projects',
    description: 'Lists the FastTicket projects (id + label).',
    annotations: { readOnlyHint: true },
  },
  async () => json(PROJECT_IDS.map((id) => ({ id, label: PROJECT_LABELS[id] }))),
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
  async ({ projectId, ...filters }) => json(await listTickets(projectId, filters)),
);

server.registerTool(
  'get_ticket',
  {
    title: 'Get ticket',
    description: 'Returns a ticket with its full description.',
    inputSchema: { projectId, ticketId },
    annotations: { readOnlyHint: true },
  },
  async ({ projectId, ticketId }) => {
    const ticket = await getTicket(projectId, ticketId);
    return ticket ? json(ticket) : notFound(ticketId);
  },
);

await server.connect(new StdioServerTransport());
