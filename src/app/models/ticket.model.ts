import { Timestamp } from 'firebase/firestore';

export type Priority = 'low' | 'medium' | 'high';
export type Category = 'bug' | 'idea' | 'design' | 'tech';
export type Status = 'backlog' | 'todo' | 'inprogress' | 'done' | 'resolved';
export type ProjectId = 'alveola' | 'ludistes';
export type Tab = 'backlog' | 'kanban' | 'resolved';
export type PriorityFilter = 'all' | Priority;

export interface Comment {
  author: string;
  authorUid?: string;
  text: string;
  createdAt: Timestamp;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  category: Category;
  createdBy: string;
  createdByUid?: string;
  createdAt: Timestamp;
  version?: string;
  prLink?: string;
  bugReportLinks?: string[];
  timeSpentMinutes?: number;
  comments?: Comment[];
  attachments?: string[];
  upvotes?: string[];
}

/**
 * Comment shape as it crosses the server → client boundary via
 * REQUEST_CONTEXT/TransferState during SSR: `createdAt` becomes a plain
 * millis number (Admin SDK's Timestamp class isn't JSON-serializable).
 */
export interface SerializedComment extends Omit<Comment, 'createdAt'> {
  createdAt: number;
}

/**
 * Ticket shape as it crosses the server → client boundary via
 * REQUEST_CONTEXT/TransferState during SSR: `createdAt` becomes a plain
 * millis number, and so does each comment's `createdAt` (see
 * SerializedComment) — ticket-detail SSR renders the comments list, so
 * these need to survive the trip too, not just the ticket's own timestamp.
 */
export interface SerializedTicket extends Omit<Ticket, 'createdAt' | 'comments'> {
  createdAt: number;
  comments?: SerializedComment[];
}

export interface Project {
  id: ProjectId;
  label: string;
}

export interface ToastMessage {
  key: string;
  params?: Record<string, string | number>;
}

export interface NewTicketForm {
  title: string;
  description: string;
  priority: Priority;
  category: Category;
}
