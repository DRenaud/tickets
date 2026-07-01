export type Priority = 'low' | 'medium' | 'high';
export type Category = 'bug' | 'idea' | 'design' | 'tech';
export type Status = 'backlog' | 'todo' | 'inprogress' | 'resolved';
export type ProjectId = 'alveola' | 'ludistes';
export type Tab = 'backlog' | 'kanban' | 'resolved';
export type PriorityFilter = 'all' | Priority;

export interface Ticket {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  category: Category;
  assignee: string;
  version?: string;
}

/** Ticket seed shape used only to populate a project's Firestore collection the first time it's empty. */
export interface SeedTicket extends Omit<Ticket, 'id'> {
  id: number;
}

export interface Project {
  id: ProjectId;
  label: string;
}

export interface NewTicketForm {
  title: string;
  description: string;
  priority: Priority;
  category: Category;
}
