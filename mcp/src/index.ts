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
  addComment,
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
} from './tickets.ts';

const projectId = z.enum(PROJECT_IDS).describe('Project id');
const ticketId = z.string().min(1).describe('Firestore ticket id');

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function notFound(id: string) {
  return { content: [{ type: 'text' as const, text: `Ticket ${id} not found.` }], isError: true };
}

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
    description: 'Returns a ticket with its full description and comments.',
    inputSchema: { projectId, ticketId },
    annotations: { readOnlyHint: true },
  },
  async ({ projectId, ticketId }) => {
    const ticket = await getTicket(projectId, ticketId);
    return ticket ? json(ticket) : notFound(ticketId);
  },
);

server.registerTool(
  'create_ticket',
  {
    title: 'Create ticket',
    description: 'Creates a ticket in the backlog of a project.',
    inputSchema: {
      projectId,
      title: z.string().trim().min(1),
      description: z.string().optional(),
      priority: z.enum(PRIORITIES).default('medium'),
      category: z.enum(CATEGORIES),
    },
  },
  async ({ projectId, ...input }) => json(await createTicket(projectId, input)),
);

server.registerTool(
  'update_ticket',
  {
    title: 'Update ticket',
    description:
      'Updates fields of a ticket. Only the provided fields change. ' +
      'Use status to move it across the board (e.g. backlog → todo to add it to the sprint).',
    inputSchema: {
      projectId,
      ticketId,
      title: z.string().trim().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      category: z.enum(CATEGORIES).optional(),
      prLink: z.string().optional().describe('Pull request URL'),
      timeSpentMinutes: z.number().int().min(0).optional(),
      locked: z.boolean().optional().describe('Locked tickets can only be edited by an admin in the app'),
    },
    annotations: { idempotentHint: true },
  },
  async ({ projectId, ticketId, ...changes }) => {
    const ticket = await updateTicket(projectId, ticketId, changes);
    return ticket ? json(ticket) : notFound(ticketId);
  },
);

server.registerTool(
  'add_comment',
  {
    title: 'Add comment',
    description: 'Adds a comment to a ticket.',
    inputSchema: { projectId, ticketId, text: z.string().trim().min(1) },
  },
  async ({ projectId, ticketId, text }) => {
    const ticket = await addComment(projectId, ticketId, text);
    return ticket ? json(ticket) : notFound(ticketId);
  },
);

await server.connect(new StdioServerTransport());
