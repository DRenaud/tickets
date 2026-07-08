import { App, ServiceAccount, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { DocumentData, Firestore, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { SerializedComment, SerializedTicket } from '../models/ticket.model';

/**
 * Server-only: returns a Firebase Admin App instance (bypasses firestore.rules — this must never run in the browser).
 * @returns Firebase Admin App instance
 */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return getApp();

  const serviceAccount = JSON.parse(process.env['SERVICE_ACCOUNT']!) as ServiceAccount;
  return initializeApp({ credential: cert(serviceAccount) });
}
/**
 * Server-only: returns a Firestore instance with Admin privileges (bypasses firestore.rules — this must never run in the browser).
 * @returns Firestore instance with Admin privileges
 */
function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

function toMillis(timestamp: Timestamp | undefined): number {
  return timestamp?.toMillis?.() ?? Date.now();
}

/**
 * Converts a Firestore Admin document into a plain JSON-serializable
 * SerializedTicket — both the ticket's own `createdAt` AND each comment's
 * `createdAt` need converting, since Admin SDK Timestamp instances don't
 * survive REQUEST_CONTEXT/TransferState (they lose their `.toDate()` method
 * on the way, which is what formatDate/formatDateTime call).
 */
function serializeTicket(id: string, data: DocumentData): SerializedTicket {
  const comments = (data['comments'] as { author: string; text: string; createdAt: Timestamp }[] | undefined)?.map(
    (c): SerializedComment => ({ ...c, createdAt: toMillis(c.createdAt) }),
  );

  return {
    ...data,
    id,
    createdAt: toMillis(data['createdAt']),
    ...(comments ? { comments } : {}),
  } as SerializedTicket;
}

/**
 * Server-only: reads backlog tickets straight from Firestore with Admin
 * privileges (bypasses firestore.rules — this must never run in the browser).
 *
 * Filters to 'backlog' in memory rather than via a Firestore `.where()`
 * clause — same reason TicketStore does it client-side: combining `where`
 * with `orderBy` on a different field needs a composite index we don't
 * have, and don't need for this small a collection.
 */
export async function fetchProjectTickets(projectId: string): Promise<SerializedTicket[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection('projects')
    .doc(projectId)
    .collection('tickets')
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((doc) => serializeTicket(doc.id, doc.data()));
}

/**
 * Server-only: reads a single ticket straight from Firestore with Admin
 * privileges (bypasses firestore.rules — this must never run in the browser).
 * @param projectId Project of the ticket
 * @param ticketId ID of the ticket
 * @returns Serialized ticket or null if not found
 */
export async function fetchTicketDetail(projectId: string, ticketId: string): Promise<SerializedTicket | null> {
  const db = getAdminFirestore();
  const doc = await db.collection('projects').doc(projectId).collection('tickets').doc(ticketId).get();

  if (!doc.exists) return null;

  return serializeTicket(doc.id, doc.data()!);
}
