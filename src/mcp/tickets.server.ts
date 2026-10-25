import { type DocumentData, FieldValue, Timestamp } from 'firebase-admin/firestore';
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

// Admin SDK access bypasses firestore.rules: every write below (everything
// after getTicket) must only be reachable through the authenticated MCP tools
// registered in mcp-router.server.ts.
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

/** Statuses a ticket can be moved to by hand: `resolved` is only reached through a release. */
export const SPRINT_STATUSES = ['backlog', 'todo', 'inprogress', 'done'] as const satisfies readonly Status[];

export interface TicketChanges {
  title?: string;
  description?: string;
  status?: (typeof SPRINT_STATUSES)[number];
  priority?: Priority;
  category?: Category;
  prLink?: string;
  bugReportLinks?: string[];
  timeSpentMinutes?: number;
  locked?: boolean;
}

export interface SprintView {
  sprintNumber: number;
  sprintName: string;
  counts: Record<Status, number>;
}

function projectDoc(projectId: ProjectId) {
  return getAdminFirestore().collection('projects').doc(projectId);
}

export async function createTicket(
  projectId: ProjectId,
  input: { title: string; description?: string; priority: Priority; category: Category },
): Promise<TicketView> {
  const ref = await ticketsCollection(projectId).add({
    title: input.title,
    description: input.description ?? '',
    status: 'backlog',
    priority: input.priority,
    category: input.category,
    createdBy: 'MCP',
    createdAt: FieldValue.serverTimestamp(),
  });
  return (await getTicket(projectId, ref.id))!;
}

/** Returns null when the ticket doesn't exist. */
export async function updateTicket(
  projectId: ProjectId,
  ticketId: string,
  changes: TicketChanges,
): Promise<TicketView | null> {
  const ref = ticketsCollection(projectId).doc(ticketId);
  const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
  try {
    await ref.update(defined);
  } catch (error) {
    if ((error as { code?: number }).code === 5) return null; // NOT_FOUND
    throw error;
  }
  return getTicket(projectId, ticketId);
}

export async function getSprint(projectId: ProjectId): Promise<SprintView> {
  const [meta, tickets] = await Promise.all([projectDoc(projectId).get(), ticketsCollection(projectId).get()]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const doc of tickets.docs) counts[doc.data()['status'] as Status]++;
  return {
    sprintNumber: meta.data()?.['sprintNumber'] ?? 1,
    sprintName: meta.data()?.['sprintName'] ?? 'Sprint 1',
    counts,
  };
}

export async function renameSprint(projectId: ProjectId, sprintName: string): Promise<void> {
  await projectDoc(projectId).set({ sprintName }, { merge: true });
}

/**
 * Same as the app's confirmRelease: every `done` ticket becomes `resolved`
 * with the version, and the project moves on to the next sprint. Run in a
 * transaction so two concurrent releases can't both bump the sprint number.
 */
export async function releaseSprint(
  projectId: ProjectId,
  version: string,
  nextSprintName?: string,
): Promise<{ version: string; released: number; sprintNumber: number; sprintName: string }> {
  const db = getAdminFirestore();
  return db.runTransaction(async (tx) => {
    const project = projectDoc(projectId);
    const [meta, done] = await Promise.all([
      tx.get(project),
      tx.get(ticketsCollection(projectId).where('status', '==', 'done')),
    ]);
    if (done.empty) throw new NothingToRelease();
    const sprintNumber = ((meta.data()?.['sprintNumber'] as number | undefined) ?? 1) + 1;
    const sprintName = nextSprintName || `Sprint ${sprintNumber}`;
    for (const doc of done.docs) tx.update(doc.ref, { status: 'resolved', version });
    tx.set(project, { sprintNumber, sprintName }, { merge: true });
    return { version, released: done.size, sprintNumber, sprintName };
  });
}

export class NothingToRelease extends Error {
  constructor() {
    super('No ticket is in the done column: nothing to release.');
  }
}
