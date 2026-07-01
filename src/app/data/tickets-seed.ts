import { Category, Project, ProjectId, Ticket } from '../models/ticket.model';

export const PROJECTS: Project[] = [
  { id: 'alveola', label: 'Alvéola' },
  { id: 'ludistes', label: 'Ludistes Charentais' },
];

export const GREETINGS: Record<ProjectId, string> = {
  alveola: "Salut ! Voici ce qu'il se passe sur Alvéola 👋",
  ludistes: "Coucou les ludistes ! Un coup d'œil sur les tickets 🎲",
};

export const CATEGORY_META: Record<Category, { emoji: string; label: string }> = {
  bug: { emoji: '🐛', label: 'Bug' },
  idea: { emoji: '💡', label: 'Idée' },
  design: { emoji: '🎨', label: 'Design' },
  tech: { emoji: '⚙️', label: 'Technique' },
};

export const INITIAL_TICKETS: Record<ProjectId, Ticket[]> = {
  alveola: [
    { id: 1, title: "Le bouton d'export PDF crash sur Firefox", status: 'backlog', priority: 'high', category: 'bug', assignee: 'FL' },
    { id: 2, title: 'Ajouter le mode hors-ligne', status: 'backlog', priority: 'medium', category: 'idea', assignee: 'JM' },
    { id: 3, title: 'Revoir les couleurs du dashboard', status: 'backlog', priority: 'low', category: 'design', assignee: 'FL' },
    { id: 4, title: "Le login Google boucle à l'infini", status: 'todo', priority: 'high', category: 'bug', assignee: 'FL' },
    { id: 5, title: 'Notifications push', status: 'inprogress', priority: 'medium', category: 'idea', assignee: 'JM' },
    { id: 6, title: 'Lenteur sur la liste de 500+ tickets', status: 'inprogress', priority: 'high', category: 'tech', assignee: 'FL' },
    { id: 7, title: 'Correction du fuseau horaire', status: 'resolved', priority: 'medium', category: 'bug', assignee: 'FL', version: 'v1.3.0' },
    { id: 8, title: 'Ajout du raccourci clavier ⌘K', status: 'resolved', priority: 'low', category: 'idea', assignee: 'JM', version: 'v1.3.0' },
    { id: 9, title: 'Export CSV', status: 'resolved', priority: 'medium', category: 'idea', assignee: 'FL', version: 'v1.2.0' },
    { id: 10, title: "Crash à l'ouverture sur Safari", status: 'resolved', priority: 'high', category: 'bug', assignee: 'JM', version: 'v1.2.0' },
    { id: 11, title: 'Refonte du footer', status: 'resolved', priority: 'low', category: 'design', assignee: 'FL', version: 'v1.1.0' },
  ],
  ludistes: [
    { id: 51, title: "Page d'inscription aux soirées jeux buguée sur mobile", status: 'backlog', priority: 'high', category: 'bug', assignee: 'CB' },
    { id: 52, title: 'Ajouter un calendrier des évènements', status: 'backlog', priority: 'medium', category: 'idea', assignee: 'FL' },
    { id: 53, title: 'Lien vers le règlement du tournoi cassé', status: 'todo', priority: 'medium', category: 'bug', assignee: 'CB' },
    { id: 54, title: 'Formulaire de dons', status: 'inprogress', priority: 'low', category: 'idea', assignee: 'FL' },
    { id: 55, title: "Corriger l'affichage des photos de la dernière soirée", status: 'resolved', priority: 'medium', category: 'bug', assignee: 'CB', version: 'v0.9.0' },
    { id: 56, title: "Ajout de la page 'Nos jeux favoris'", status: 'resolved', priority: 'low', category: 'idea', assignee: 'FL', version: 'v0.9.0' },
    { id: 57, title: 'Fix du menu mobile', status: 'resolved', priority: 'high', category: 'bug', assignee: 'CB', version: 'v0.8.0' },
  ],
};
