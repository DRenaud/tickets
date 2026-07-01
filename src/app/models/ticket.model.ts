export type Priority = 'low' | 'medium' | 'high';
export type Category = 'bug' | 'idea' | 'design' | 'tech';
export type Status = 'backlog' | 'todo' | 'inprogress' | 'resolved';
export type ProjectId = 'alveola' | 'ludistes';
export type Tab = 'backlog' | 'kanban' | 'resolved';
export type PriorityFilter = 'all' | Priority;

export interface Ticket {
  id: number;
  title: string;
  status: Status;
  priority: Priority;
  category: Category;
  assignee: string;
  version?: string;
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
