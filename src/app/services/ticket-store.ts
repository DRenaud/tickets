import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  CollectionReference,
  Firestore,
  Timestamp,
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { CATEGORY_META, GREETINGS, INITIAL_TICKETS, PROJECTS } from '../data/tickets-seed';
import { Category, NewTicketForm, PriorityFilter, ProjectId, Tab, Ticket } from '../models/ticket.model';
import { getTheme } from '../theme/theme';
import { AuthService } from './auth-service';
import { FirebaseAppService } from './firebase-app';

@Injectable({ providedIn: 'root' })
export class TicketStore {
  readonly projects = PROJECTS;

  readonly dark = signal(true);
  readonly project = signal<ProjectId>('alveola');
  readonly tab = signal<Tab>('backlog');
  readonly filterPriority = signal<PriorityFilter>('all');
  readonly pickerOpen = signal(false);
  readonly newTicketOpen = signal(false);
  readonly selectedBacklog = signal<ReadonlySet<string>>(new Set());
  readonly expandedVersions = signal<Record<string, boolean>>({ 'v1.3.0': true, 'v0.9.0': true });
  readonly toast = signal<string | null>(null);

  private readonly db: Firestore | null;
  private readonly currentTickets = signal<Ticket[]>([]);
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const firebaseApp = inject(FirebaseAppService);
    const auth = inject(AuthService);
    this.db = firebaseApp.app ? getFirestore(firebaseApp.app) : null;

    effect((onCleanup) => {
      const projectId = this.project();
      if (!auth.isAuthenticated()) {
        this.currentTickets.set([]);
        return;
      }
      const unsubscribe = this.subscribeToProject(projectId);
      onCleanup(() => unsubscribe?.());
    });
  }

  readonly theme = computed(() => getTheme(this.dark()));
  readonly greeting = computed(() => GREETINGS[this.project()]);

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

  isSelected(id: string): boolean {
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

  toggleSelect(id: string): void {
    this.selectedBacklog.update((sel) => {
      const next = new Set(sel);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  addSelectedToSprint(): void {
    const ids = this.selectedBacklog();
    this.selectedBacklog.set(new Set());
    for (const id of ids) {
      this.updateTicket(id, { status: 'todo' });
    }
  }

  addFromBacklogToSprint(id: string): void {
    this.updateTicket(id, { status: 'todo' });
  }

  advanceTicket(id: string): void {
    const ticket = this.currentTickets().find((t) => t.id === id);
    if (!ticket) return;
    if (ticket.status === 'todo') {
      this.updateTicket(id, { status: 'inprogress' });
    } else if (ticket.status === 'inprogress') {
      this.updateTicket(id, { status: 'resolved', version: 'v1.3.0' });
      this.showToast('🎉 Résolu — ' + ticket.title);
    }
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

  async submitNewTicket(form: NewTicketForm): Promise<void> {
    const title = form.title.trim();
    if (!title || !this.db) return;
    this.newTicketOpen.set(false);
    try {
      await addDoc(this.ticketsCollection(this.project()), {
        title,
        status: 'backlog',
        priority: form.priority,
        category: form.category,
        assignee: 'FL',
        createdAt: serverTimestamp(),
      });
      this.showToast('✨ Ticket créé');
    } catch {
      this.showToast("⚠️ Échec de création du ticket");
    }
  }

  private updateTicket(id: string, changes: Partial<Ticket>): void {
    if (!this.db) return;
    const ref = doc(this.db, 'projects', this.project(), 'tickets', id);
    updateDoc(ref, changes).catch(() => this.showToast('⚠️ Échec de la mise à jour'));
  }

  private ticketsCollection(projectId: ProjectId): CollectionReference {
    return collection(this.db!, 'projects', projectId, 'tickets');
  }

  private subscribeToProject(projectId: ProjectId): (() => void) | undefined {
    if (!this.db) return undefined;

    this.currentTickets.set([]);
    let seeded = false;
    const projectQuery = query(this.ticketsCollection(projectId), orderBy('createdAt', 'desc'));

    return onSnapshot(projectQuery, (snapshot) => {
      if (snapshot.empty && !seeded) {
        seeded = true;
        void this.seedProject(projectId);
        return;
      }
      this.currentTickets.set(
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Ticket),
      );
    });
  }

  private async seedProject(projectId: ProjectId): Promise<void> {
    if (!this.db) return;
    const seedTickets = INITIAL_TICKETS[projectId];
    const batch = writeBatch(this.db);
    const now = Date.now();
    seedTickets.forEach((seedTicket, index) => {
      const { id, ...data } = seedTicket;
      const ref = doc(this.db!, 'projects', projectId, 'tickets', String(id));
      batch.set(ref, { ...data, createdAt: Timestamp.fromMillis(now - index * 1000) });
    });
    await batch.commit();
  }
}
