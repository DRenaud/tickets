import { type DocumentData, Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../app/services/firebase-admin.server';
import { PROJECTS } from '../app/data/tickets-seed';
import { type Category, type Priority, PRIORITY_RANK, type ProjectId, type Status } from '../app/models/ticket.model';

// Runtime lists of the model's union types, needed for the MCP tools' input
// schemas. `satisfies` makes the compiler flag them if the model changes.
export const PROJECT_IDS = PROJECTS.map((p) => p.id) as [ProjectId, ...ProjectId[]];
export const PRIORITIES = ['low', 'medium', 'high'] as const satisfies readonly Priority[];
export const CATEGORIES = ['bug', 'idea', 'design', 'tech'] as const satisfies readonly Category[];
export const STATUSES = ['backlog', 'todo', 'inprogress', 'done', 'resolved'] as const satisfies readonly Status[];

export interface TicketComment {
  author: string;
  text: string;
  createdAt: string;
}

export interface TicketView {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  category: Category;
  createdBy: string;
  createdAt: string;
  version?: string;
  prLink?: string;
  bugReportLinks?: string[];
  timeSpentMinutes?: number;
  upvotes: number;
  locked: boolean;
  comments: TicketComment[];
}

// Read-only on purpose: Admin SDK access bypasses firestore.rules, and the
// /mcp endpoint has no auth. Never add a write here without adding auth.
function ticketsCollection(projectId: ProjectId) {
  return getAdminFirestore().collection('projects').doc(projectId).collection('tickets');
}

function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

function toView(id: string, data: DocumentData): TicketView {
  const comments = (data['comments'] as { author: string; text: string; createdAt: unknown }[] | undefined) ?? [];
  return {
    id,
    title: data['title'],
    description: data['description'] || undefined,
    status: data['status'],
    priority: data['priority'],
    category: data['category'],
    createdBy: data['createdBy'] ?? data['assignee'] ?? '?',
    createdAt: toIso(data['createdAt']),
    version: data['version'],
    prLink: data['prLink'] || undefined,
    bugReportLinks: data['bugReportLinks'],
    timeSpentMinutes: data['timeSpentMinutes'],
    upvotes: (data['upvotes'] as string[] | undefined)?.length ?? 0,
    locked: !!data['locked'],
    comments: comments.map((c) => ({ author: c.author, text: c.text, createdAt: toIso(c.createdAt) })),
  };
}

/** Same ordering as the app's views: upvotes desc, then priority high → low. */
function sortTickets(tickets: TicketView[]): TicketView[] {
  return [...tickets].sort(
    (a, b) => b.upvotes - a.upvotes || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
}

export async function listTickets(
  projectId: ProjectId,
  filters: { status?: Status; priority?: Priority; category?: Category },
): Promise<TicketView[]> {
  // Filtered in memory, like the app: where() + orderBy() on different
  // fields would need a composite index.
  const snap = await ticketsCollection(projectId).orderBy('createdAt', 'desc').get();
  const tickets = snap.docs
    .map((doc) => toView(doc.id, doc.data()))
    .filter(
      (t) =>
        (!filters.status || t.status === filters.status) &&
        (!filters.priority || t.priority === filters.priority) &&
        (!filters.category || t.category === filters.category),
    );
  return sortTickets(tickets);
}

export async function getTicket(projectId: ProjectId, ticketId: string): Promise<TicketView | null> {
  const doc = await ticketsCollection(projectId).doc(ticketId).get();
  return doc.exists ? toView(doc.id, doc.data()!) : null;
}
