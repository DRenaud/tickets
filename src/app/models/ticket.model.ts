import { Timestamp } from 'firebase/firestore';

export type Priority = 'low' | 'medium' | 'high';
export type Category = 'bug' | 'idea' | 'design' | 'tech';
export type Status = 'backlog' | 'todo' | 'inprogress' | 'done' | 'resolved';
export type ProjectId = 'alveola' | 'ludistes';
export type Tab = 'backlog' | 'kanban' | 'resolved';
export type PriorityFilter = 'all' | Priority;

export interface Comment {
  author: string;
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
  createdAt: Timestamp;
  version?: string;
  prLink?: string;
  bugReportLinks?: string[];
  timeSpentMinutes?: number;
  comments?: Comment[];
  attachments?: string[];
  upvotes?: string[];
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
