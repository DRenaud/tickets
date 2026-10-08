import { type ServiceAccount, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type DocumentData, FieldValue, type Firestore, Timestamp, getFirestore } from 'firebase-admin/firestore';

// Mirrors src/app/models/ticket.model.ts and src/app/data/tickets-seed.ts —
// duplicated rather than imported, since the app's model file pulls in the
// browser Firebase SDK at runtime.
export const PROJECT_IDS = ['alveola', 'ludistes', 'ticket'] as const;
export const PROJECT_LABELS: Record<ProjectId, string> = {
  alveola: 'Alvéola',
  ludistes: 'Ludistes Charentais',
  ticket: 'Ticketing',
};
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export const CATEGORIES = ['bug', 'idea', 'design', 'tech'] as const;
export const STATUSES = ['backlog', 'todo', 'inprogress', 'done', 'resolved'] as const;

export type ProjectId = (typeof PROJECT_IDS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

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

export interface TicketUpdate {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  category?: Category;
  prLink?: string;
  timeSpentMinutes?: number;
  locked?: boolean;
}

/**
 * Admin SDK access: bypasses firestore.rules, so whoever runs this server
 * acts with admin rights on every project. Same SERVICE_ACCOUNT env var as
 * the SSR server (src/app/services/firebase-admin.server.ts).
 */
function db(): Firestore {
  if (!getApps().length) {
    const raw = process.env['SERVICE_ACCOUNT'];
    if (!raw) throw new Error('SERVICE_ACCOUNT env var is missing (Firebase service account JSON).');
    initializeApp({ credential: cert(JSON.parse(raw) as ServiceAccount) });
  }
  return getFirestore();
}

const author = (): string => process.env['TICKETS_AUTHOR'] || 'MCP';

function ticketsCollection(projectId: ProjectId) {
  return db().collection('projects').doc(projectId).collection('tickets');
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

export async function createTicket(
  projectId: ProjectId,
  input: { title: string; description?: string; priority: Priority; category: Category },
): Promise<TicketView> {
  const ref = await ticketsCollection(projectId).add({
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    status: 'backlog',
    priority: input.priority,
    category: input.category,
    createdBy: author(),
    createdAt: FieldValue.serverTimestamp(),
  });
  return (await getTicket(projectId, ref.id))!;
}

export async function updateTicket(
  projectId: ProjectId,
  ticketId: string,
  changes: TicketUpdate,
): Promise<TicketView | null> {
  const ref = ticketsCollection(projectId).doc(ticketId);
  if (!(await ref.get()).exists) return null;
  const update = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
  if (Object.keys(update).length) await ref.update(update);
  return getTicket(projectId, ticketId);
}

export async function addComment(projectId: ProjectId, ticketId: string, text: string): Promise<TicketView | null> {
  const ref = ticketsCollection(projectId).doc(ticketId);
  if (!(await ref.get()).exists) return null;
  // serverTimestamp() isn't allowed inside array elements, hence Timestamp.now().
  await ref.update({
    comments: FieldValue.arrayUnion({ author: author(), text: text.trim(), createdAt: Timestamp.now() }),
  });
  return getTicket(projectId, ticketId);
}
