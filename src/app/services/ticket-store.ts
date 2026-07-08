import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { CATEGORY_META, PROJECTS } from '../data/tickets-seed';
import { Category, NewTicketForm, PriorityFilter, ProjectId, Tab, Ticket, ToastMessage } from '../models/ticket.model';
import { getTheme } from '../theme/theme';
import { AuthService } from './auth-service';
import { FirebaseAppService } from './firebase-app';
import { ProjectAccessService } from './project-access-service';

@Injectable({ providedIn: 'root' })
export class TicketStore {
  private readonly auth = inject(AuthService);
  private readonly projectAccess = inject(ProjectAccessService);
  readonly isAdmin = this.auth.isAdmin;
  readonly isRealUser = this.auth.isRealUser;
  readonly projects = computed(() => PROJECTS.filter((p) => this.projectAccess.knownProjectIds().has(p.id)));

  readonly dark = signal(true);
  readonly project = signal<ProjectId>('alveola');
  readonly tab = signal<Tab>('backlog');
  readonly filterPriority = signal<PriorityFilter>('all');
  readonly pickerOpen = signal(false);
  readonly newTicketOpen = signal(false);
  readonly selectedBacklog = signal<ReadonlySet<string>>(new Set());
  readonly expandedVersions = signal<Record<string, boolean>>({ 'v1.3.0': true, 'v0.9.0': true });
  readonly toast = signal<ToastMessage | null>(null);

  readonly selectedTicketId = signal<string | null>(null);
  readonly sprintName = signal('Sprint 1');
  readonly sprintNumber = signal(1);
  readonly releaseModalOpen = signal(false);
  readonly releaseForm = signal<{ version: string; nextSprint: string }>({ version: '', nextSprint: '' });
  readonly loginModalOpen = signal(false);

  private readonly db: Firestore | null;
  private readonly currentTickets = signal<Ticket[]>([]);
  private toastTimer?: ReturnType<typeof setTimeout>;
  private pendingAction: (() => void) | null = null;

  constructor() {
    const firebaseApp = inject(FirebaseAppService);
    this.db = firebaseApp.app ? getFirestore(firebaseApp.app) : null;

    effect((onCleanup) => {
      const projectId = this.project();
      if (!this.auth.isAuthenticated()) {
        this.currentTickets.set([]);
        return;
      }
      const unsubscribeTickets = this.subscribeToTickets(projectId);
      const unsubscribeMeta = this.subscribeToProjectMeta(projectId);
      onCleanup(() => {
        unsubscribeTickets?.();
        unsubscribeMeta?.();
      });
    });
  }

  readonly theme = computed(() => getTheme(this.dark()));

  readonly allBacklogList = computed(() => this.currentTickets().filter((t) => t.status === 'backlog'));
  readonly backlogList = computed(() => {
    const filter = this.filterPriority();
    const list = this.allBacklogList();
    return filter === 'all' ? list : list.filter((t) => t.priority === filter);
  });
  readonly todoList = computed(() => this.currentTickets().filter((t) => t.status === 'todo'));
  readonly inProgressList = computed(() => this.currentTickets().filter((t) => t.status === 'inprogress'));
  readonly doneList = computed(() => this.currentTickets().filter((t) => t.status === 'done'));
  readonly resolvedList = computed(() => this.currentTickets().filter((t) => t.status === 'resolved'));

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

  readonly sprintCount = computed(
    () => this.todoList().length + this.inProgressList().length + this.doneList().length,
  );

  readonly stats = computed(() => [
    { key: 'backlog', labelKey: 'stats.backlog', value: this.allBacklogList().length },
    { key: 'sprint', labelKey: 'stats.sprint', value: this.sprintCount() },
    { key: 'resolved', labelKey: 'stats.resolved', value: this.resolvedList().length },
  ]);

  readonly selectedCount = computed(() => this.selectedBacklog().size);
  readonly hasSelection = computed(() => this.selectedCount() > 0);

  readonly selectedTicket = computed(
    () => this.currentTickets().find((t) => t.id === this.selectedTicketId()) ?? null,
  );

  readonly releaseCanSubmit = computed(() => this.releaseForm().version.trim().length > 0);

  categoryMeta(category: Category) {
    return CATEGORY_META[category];
  }

  isSelected(id: string): boolean {
    return this.selectedBacklog().has(id);
  }

  private requireRealUser(retry: () => void): boolean {
    if (this.auth.isRealUser()) return true;
    this.pendingAction = retry;
    this.loginModalOpen.set(true);
    return false;
  }

  openLoginModal(): void {
    this.loginModalOpen.set(true);
  }

  closeLoginModal(): void {
    this.loginModalOpen.set(false);
    this.pendingAction = null;
  }

  onLoginSuccess(): void {
    this.loginModalOpen.set(false);
    void this.projectAccess.onLoginSuccess();
    const action = this.pendingAction;
    this.pendingAction = null;
    action?.();
  }

  toggleDark(): void {
    this.dark.update((d) => !d);
  }

  switchProject(id: ProjectId): void {
    this.projectAccess.markVisited(id);
    this.project.set(id);
    this.tab.set('backlog');
    this.selectedBacklog.set(new Set());
    this.filterPriority.set('all');
    this.selectedTicketId.set(null);
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
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ids = this.selectedBacklog();
    this.selectedBacklog.set(new Set());
    for (const id of ids) {
      this.updateTicket(id, { status: 'todo' });
    }
  }

  addFromBacklogToSprint(id: string): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    this.updateTicket(id, { status: 'todo' });
  }

  advanceTicket(id: string): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ticket = this.currentTickets().find((t) => t.id === id);
    if (!ticket) return;
    if (ticket.status === 'todo') {
      this.updateTicket(id, { status: 'inprogress' });
    } else if (ticket.status === 'inprogress') {
      this.updateTicket(id, { status: 'done' });
      this.showToast('toast.done', { title: ticket.title });
    }
  }

  showToast(key: string, params?: Record<string, string | number>): void {
    this.toast.set({ key, params });
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
    if (!this.requireRealUser(() => this.submitNewTicket(form))) return;
    const title = form.title.trim();
    if (!title || !this.db) return;
    this.newTicketOpen.set(false);
    try {
      await addDoc(this.ticketsCollection(this.project()), {
        title,
        description: form.description.trim(),
        status: 'backlog',
        priority: form.priority,
        category: form.category,
        createdBy: this.auth.initials(),
        createdAt: serverTimestamp(),
      });
      this.showToast('toast.created');
    } catch {
      this.showToast('toast.createFailed');
    }
  }

  openDetail(id: string): void {
    this.selectedTicketId.set(id);
  }

  closeDetail(): void {
    this.selectedTicketId.set(null);
  }

  addComment(text: string): void {
    if (!this.requireRealUser(() => this.addComment(text))) return;
    const trimmed = text.trim();
    const ticket = this.selectedTicket();
    if (!trimmed || !ticket) return;
    const comments = [...(ticket.comments ?? []), { author: this.auth.initials(), text: trimmed, createdAt: Timestamp.now() }];
    this.updateTicket(ticket.id, { comments });
  }

  removeComment(index: number): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ticket = this.selectedTicket();
    if (!ticket) return;
    const comments = [...(ticket.comments ?? [])];
    comments.splice(index, 1);
    this.updateTicket(ticket.id, { comments });
  }

  deleteTicket(id: string): void {
    if (!this.isAdmin() || !this.db) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ref = doc(this.db, 'projects', this.project(), 'tickets', id);
    deleteDoc(ref)
      .then(() => {
        if (this.selectedTicketId() === id) this.closeDetail();
      })
      .catch(() => this.showToast('toast.updateFailed'));
  }

  upvoteCount(ticket: Ticket): number {
    return ticket.upvotes?.length ?? 0;
  }

  hasUpvoted(ticket: Ticket): boolean {
    return !!ticket.upvotes?.includes(this.auth.user()?.uid ?? '');
  }

  toggleUpvote(id: string): void {
    if (!this.requireRealUser(() => this.toggleUpvote(id))) return;
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    const ticket = this.currentTickets().find((t) => t.id === id);
    if (!ticket) return;
    const upvotes = ticket.upvotes ?? [];
    const next = upvotes.includes(uid) ? upvotes.filter((u) => u !== uid) : [...upvotes, uid];
    this.updateTicket(id, { upvotes: next });
  }

  updatePrLink(link: string): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ticket = this.selectedTicket();
    if (!ticket) return;
    this.updateTicket(ticket.id, { prLink: link });
  }

  addBugLink(link: string): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const trimmed = link.trim();
    const ticket = this.selectedTicket();
    if (!trimmed || !ticket) return;
    this.updateTicket(ticket.id, { bugReportLinks: [...(ticket.bugReportLinks ?? []), trimmed] });
  }

  removeBugLink(index: number): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ticket = this.selectedTicket();
    if (!ticket) return;
    const links = [...(ticket.bugReportLinks ?? [])];
    links.splice(index, 1);
    this.updateTicket(ticket.id, { bugReportLinks: links });
  }

  updateTimeSpent(minutes: number): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ticket = this.selectedTicket();
    if (!ticket) return;
    this.updateTicket(ticket.id, { timeSpentMinutes: Math.max(0, Math.round(minutes) || 0) });
  }

  openReleaseModal(): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    this.releaseForm.set({
      version: this.suggestNextVersion(),
      nextSprint: `Sprint ${this.sprintNumber() + 1}`,
    });
    this.releaseModalOpen.set(true);
  }

  closeReleaseModal(): void {
    this.releaseModalOpen.set(false);
  }

  updateReleaseVersion(version: string): void {
    this.releaseForm.update((f) => ({ ...f, version }));
  }

  updateReleaseNextSprint(nextSprint: string): void {
    this.releaseForm.update((f) => ({ ...f, nextSprint }));
  }

  async confirmRelease(): Promise<void> {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const version = this.releaseForm().version.trim();
    if (!version || !this.db) return;
    const nextSprintLabel = this.releaseForm().nextSprint.trim() || `Sprint ${this.sprintNumber() + 1}`;
    const doneTickets = this.doneList();
    const projectId = this.project();

    this.releaseModalOpen.set(false);
    try {
      const batch = writeBatch(this.db);
      for (const ticket of doneTickets) {
        batch.update(doc(this.db, 'projects', projectId, 'tickets', ticket.id), { status: 'resolved', version });
      }
      batch.set(
        doc(this.db, 'projects', projectId),
        { sprintNumber: this.sprintNumber() + 1, sprintName: nextSprintLabel },
        { merge: true },
      );
      await batch.commit();
      this.showToast('toast.released', {
        version,
        count: doneTickets.length,
        nextSprint: nextSprintLabel,
      });
    } catch {
      this.showToast('toast.releaseFailed');
    }
  }

  private suggestNextVersion(): string {
    const versions = this.resolvedList()
      .map((t) => t.version)
      .filter((v): v is string => !!v)
      .sort()
      .reverse();
    const latest = versions[0];
    const match = latest?.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (!match) return 'v1.0.0';
    return `v${match[1]}.${Number(match[2]) + 1}.0`;
  }

  private updateTicket(id: string, changes: Partial<Ticket>): void {
    if (!this.db) return;
    const ref = doc(this.db, 'projects', this.project(), 'tickets', id);
    updateDoc(ref, changes).catch(() => this.showToast('toast.updateFailed'));
  }

  private ticketsCollection(projectId: ProjectId): CollectionReference {
    return collection(this.db!, 'projects', projectId, 'tickets');
  }

  private toTicket(projectId: ProjectId, docSnap: QueryDocumentSnapshot<DocumentData>): Ticket {
    const data = docSnap.data() as Record<string, unknown>;
    if (data['assignee'] !== undefined && data['createdBy'] === undefined) {
      const ref = doc(this.db!, 'projects', projectId, 'tickets', docSnap.id);
      updateDoc(ref, { createdBy: data['assignee'], assignee: deleteField() }).catch(() => {});
    }
    return {
      ...data,
      id: docSnap.id,
      createdBy: (data['createdBy'] as string | undefined) ?? (data['assignee'] as string | undefined) ?? '?',
    } as Ticket;
  }

  private subscribeToTickets(projectId: ProjectId): (() => void) | undefined {
    if (!this.db) return undefined;

    this.currentTickets.set([]);
    const projectQuery = query(this.ticketsCollection(projectId), orderBy('createdAt', 'desc'));

    return onSnapshot(projectQuery, (snapshot) => {
      this.currentTickets.set(snapshot.docs.map((docSnap) => this.toTicket(projectId, docSnap)));
    });
  }

  private subscribeToProjectMeta(projectId: ProjectId): (() => void) | undefined {
    if (!this.db) return undefined;

    const ref = doc(this.db, 'projects', projectId);
    let initialized = false;

    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        if (!initialized) {
          initialized = true;
          void setDoc(ref, { sprintNumber: 1, sprintName: 'Sprint 1' });
        }
        return;
      }
      const data = snap.data();
      this.sprintNumber.set((data['sprintNumber'] as number | undefined) ?? 1);
      this.sprintName.set((data['sprintName'] as string | undefined) ?? 'Sprint 1');
    });
  }
}
