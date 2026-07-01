import { Injectable, computed, signal } from '@angular/core';
import { CATEGORY_META, GREETINGS, INITIAL_TICKETS, PROJECTS } from '../data/tickets-seed';
import { Category, NewTicketForm, PriorityFilter, ProjectId, Tab, Ticket } from '../models/ticket.model';
import { getTheme } from '../theme/theme';

@Injectable({ providedIn: 'root' })
export class TicketStore {
  readonly projects = PROJECTS;

  readonly dark = signal(true);
  readonly project = signal<ProjectId>('alveola');
  readonly tab = signal<Tab>('backlog');
  readonly filterPriority = signal<PriorityFilter>('all');
  readonly pickerOpen = signal(false);
  readonly newTicketOpen = signal(false);
  readonly selectedBacklog = signal<ReadonlySet<number>>(new Set());
  readonly expandedVersions = signal<Record<string, boolean>>({ 'v1.3.0': true, 'v0.9.0': true });
  readonly toast = signal<string | null>(null);

  private readonly nextId = signal(100);
  private readonly tickets = signal<Record<ProjectId, Ticket[]>>(structuredClone(INITIAL_TICKETS));
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly theme = computed(() => getTheme(this.dark()));
  readonly greeting = computed(() => GREETINGS[this.project()]);

  private readonly currentTickets = computed(() => this.tickets()[this.project()]);

  readonly allBacklogList = computed(() => this.currentTickets().filter((t) => t.status === 'backlog'));
  readonly backlogList = computed(() => {
    const filter = this.filterPriority();
    const list = this.allBacklogList();
    return filter === 'all' ? list : list.filter((t) => t.priority === filter);
  });
  readonly todoList = computed(() => this.currentTickets().filter((t) => t.status === 'todo'));
  readonly inProgressList = computed(() => this.currentTickets().filter((t) => t.status === 'inprogress'));
  readonly resolvedList = computed(() => this.currentTickets().filter((t) => t.status === 'resolved'));
  readonly sprintResolvedList = computed(() =>
    this.resolvedList()
      .filter((t) => t.version === 'v1.3.0' || t.version === 'v0.9.0')
      .slice(0, 3),
  );

  readonly resolvedGroups = computed(() => {
    const resolved = this.resolvedList();
    const expanded = this.expandedVersions();
    const versions = [...new Set(resolved.map((t) => t.version).filter((v): v is string => !!v))]
      .sort()
      .reverse();
    return versions.map((version) => ({
      version,
      tickets: resolved.filter((t) => t.version === version),
      expanded: !!expanded[version],
    }));
  });

  readonly stats = computed(() => [
    { key: 'backlog', label: 'backlog', value: this.allBacklogList().length },
    { key: 'sprint', label: 'en sprint', value: this.todoList().length + this.inProgressList().length },
    { key: 'resolved', label: 'résolus', value: this.resolvedList().length },
  ]);

  readonly selectedCount = computed(() => this.selectedBacklog().size);
  readonly hasSelection = computed(() => this.selectedCount() > 0);
  readonly sprintCount = computed(() => this.todoList().length + this.inProgressList().length);

  categoryMeta(category: Category) {
    return CATEGORY_META[category];
  }

  isSelected(id: number): boolean {
    return this.selectedBacklog().has(id);
  }

  toggleDark(): void {
    this.dark.update((d) => !d);
  }

  switchProject(id: ProjectId): void {
    this.project.set(id);
    this.tab.set('backlog');
    this.selectedBacklog.set(new Set());
    this.filterPriority.set('all');
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.pickerOpen.set(false);
  }

  setFilterPriority(p: PriorityFilter): void {
    this.filterPriority.set(p);
  }

  togglePicker(): void {
    this.pickerOpen.update((v) => !v);
  }

  toggleVersion(version: string): void {
    this.expandedVersions.update((v) => ({ ...v, [version]: !v[version] }));
  }

  clearSelection(): void {
    this.selectedBacklog.set(new Set());
  }

  toggleSelect(id: number): void {
    this.selectedBacklog.update((sel) => {
      const next = new Set(sel);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  addSelectedToSprint(): void {
    const ids = this.selectedBacklog();
    this.updateCurrentTickets((list) => list.map((t) => (ids.has(t.id) ? { ...t, status: 'todo' as const } : t)));
    this.selectedBacklog.set(new Set());
  }

  addFromBacklogToSprint(id: number): void {
    this.updateCurrentTickets((list) => list.map((t) => (t.id === id ? { ...t, status: 'todo' as const } : t)));
  }

  advanceTicket(id: number): void {
    let toastMsg: string | null = null;
    this.updateCurrentTickets((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        if (t.status === 'todo') return { ...t, status: 'inprogress' as const };
        if (t.status === 'inprogress') {
          toastMsg = '🎉 Résolu — ' + t.title;
          return { ...t, status: 'resolved' as const, version: 'v1.3.0' };
        }
        return t;
      }),
    );
    if (toastMsg) this.showToast(toastMsg);
  }

  showToast(msg: string): void {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2600);
  }

  openNewTicket(): void {
    this.newTicketOpen.set(true);
  }

  closeNewTicket(): void {
    this.newTicketOpen.set(false);
  }

  submitNewTicket(form: NewTicketForm): void {
    const title = form.title.trim();
    if (!title) return;
    const id = this.nextId();
    const ticket: Ticket = {
      id,
      title,
      status: 'backlog',
      priority: form.priority,
      category: form.category,
      assignee: 'FL',
    };
    this.updateCurrentTickets((list) => [ticket, ...list]);
    this.nextId.set(id + 1);
    this.newTicketOpen.set(false);
    this.showToast('✨ Ticket créé');
  }

  private updateCurrentTickets(fn: (list: Ticket[]) => Ticket[]): void {
    const project = this.project();
    this.tickets.update((all) => ({ ...all, [project]: fn(all[project]) }));
  }
}
