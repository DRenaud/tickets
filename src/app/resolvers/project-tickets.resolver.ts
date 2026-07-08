import { REQUEST_CONTEXT, TransferState, inject, makeStateKey } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { SerializedTicket } from '../models/ticket.model';

/**
 * The TransferState key used to stash the server-fetched project tickets for
 * the client to reuse. This is a plain JSON-serializable value, not an Admin
 * SDK class instance.
 */
const PROJECT_TICKETS_KEY = makeStateKey<SerializedTicket[]>('initialProjectTickets');

/**
 * The SSR request context is a server-only object that can be injected into
 * resolvers and other providers. It is created in server.ts and passed to the
 * bootstrapApplication() call, and is not available on the client.
 */
interface SsrRequestContext {
  initialProjectTickets?: SerializedTicket[];
}

/**
 * Runs on BOTH server and client (it's registered on a shared route).
 * - Server (RenderMode.Server only): REQUEST_CONTEXT holds what server.ts
 *   already fetched with Admin SDK privileges — stash it in TransferState so
 *   it rides along in the serialized HTML for the client to reuse.
 * - Client: REQUEST_CONTEXT doesn't exist here, read back what the server
 *   stashed instead of firing a duplicate fetch.
 */
export const projectTicketResolver: ResolveFn<SerializedTicket[] | null> = () => {
  const transferState = inject(TransferState);
  const context = inject(REQUEST_CONTEXT, { optional: true }) as SsrRequestContext | null;

  if (context?.initialProjectTickets) {
    transferState.set(PROJECT_TICKETS_KEY, context.initialProjectTickets);
    return context.initialProjectTickets;
  }

  return transferState.get(PROJECT_TICKETS_KEY, null);
};
