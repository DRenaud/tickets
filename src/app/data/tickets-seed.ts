import { Category, Project } from '../models/ticket.model';

export const PROJECTS: Project[] = [
  { id: 'alveola', label: 'Alvéola' },
  { id: 'ludistes', label: 'Ludistes Charentais' },
];

export const CATEGORY_META: Record<Category, { emoji: string; labelKey: string }> = {
  bug: { emoji: '🐛', labelKey: 'category.bug' },
  idea: { emoji: '💡', labelKey: 'category.idea' },
  design: { emoji: '🎨', labelKey: 'category.design' },
  tech: { emoji: '⚙️', labelKey: 'category.tech' },
};
