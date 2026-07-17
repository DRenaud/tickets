import { Service, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
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
import {
  Category,
  Comment,
  NewTicketForm,
  Priority,
  PRIORITY_RANK,
  PriorityFilter,
  ProjectId,
  SerializedTicket,
  Ticket,
  ToastMessage,
} from '../models/ticket.model';
import { getTheme } from '../theme/theme';
import { AuthService } from './auth-service';
import { FirebaseAppService } from './firebase-app';
import { ProjectAccessService } from './project-access-service';

@Service()
export class TicketStore {
  private readonly auth = inject(AuthService);
  private readonly projectAccess = inject(ProjectAccessService);
  readonly isAdmin = this.auth.isAdmin;
  readonly isRealUser = this.auth.isRealUser;
  readonly projects = computed(() => PROJECTS.filter((p) => this.projectAccess.knownProjectIds().has(p.id)));

  readonly dark = signal(true);
  readonly project = signal<ProjectId>('alveola');
  readonly filterPriority = signal<PriorityFilter>('all');
  readonly pickerOpen = signal(false);
  readonly newTicketOpen = signal(false);
  readonly selectedBacklog = signal<ReadonlySet<string>>(new Set());
  readonly expandedVersions = signal<Record<string, boolean>>({ 'v1.3.0': true, 'v0.9.0': true });
  readonly toast = signal<ToastMessage | null>(null);

  readonly selectedTicketId = signal<string | null>(null);
  readonly lastListRoute = signal<'backlog' | 'kanban' | 'resolved'>('backlog');
  readonly sprintName = signal('Sprint 1');
  readonly sprintNumber = signal(1);
  readonly releaseModalOpen = signal(false);
  readonly releaseForm = signal<{ version: string; nextSprint: string }>({ version: '', nextSprint: '' });
  readonly loginModalOpen = signal(false);

  private readonly db: Firestore | null;
  private readonly currentTickets = signal<Ticket[]>([]);
  private toastTimer?: ReturnType<typeof setTimeout>;
  private pendingAction: (() => void) | null = null;

  /**
   * Reconstructs a real client Timestamp for a SerializedTicket's own
   * createdAt AND every comment's createdAt — both got flattened to millis
   * numbers to survive REQUEST_CONTEXT/TransferState (Admin SDK Timestamp
   * instances don't serialize), and formatDate/formatDateTime need the real
   * Timestamp.toDate() method back.
   */
  private toClientTicket(ticket: SerializedTicket): Ticket {
    return {
      ...ticket,
      createdAt: Timestamp.fromMillis(ticket.createdAt),
      comments: ticket.comments?.map((c) => ({ ...c, createdAt: Timestamp.fromMillis(c.createdAt) })),
    } as Ticket;
  }

  /**
   * Seeds currentTickets with the full project ticket list fetched
   * server-side during SSR (see backlog-tickets.resolver.ts, used by the
   * backlog/kanban/resolved routes), so every view derived from
   * currentTickets is consistent on first paint, not just whichever tab
   * triggered the fetch.
   *
   * Guarded so it only ever fills a genuinely empty store: once the live
   * onSnapshot subscription has delivered real data, this becomes a no-op —
   * the SSR snapshot must never clobber live data.
   *
   * An empty seed list is a no-op: seeding [] over [] would still call
   * currentTickets.set() with a fresh array reference, and since callers
   * invoke this from an effect, that re-triggers the effect and spins
   * forever — during SSR the render never stabilizes and the request hangs
   * with the CPU pegged. Same reason the guard reads currentTickets via
   * untracked(): the store's own state must not become a dependency of the
   * caller's effect, or emptying the store (deleting the last ticket)
   * re-runs the seed and resurrects stale SSR data in the UI.
   */
  seedTickets(tickets: SerializedTicket[]): void {
    if (tickets.length === 0) return;
    if (untracked(this.currentTickets).length > 0) return;
    this.currentTickets.set(tickets.map((t) => this.toClientTicket(t)));
  }

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

  /**
   * Tickets order first by upvote count (desc), then by priority (high →
   * low) as a tiebreaker — matches the sort applied to every ticket view.
   */
  private sortTickets(tickets: Ticket[]): Ticket[] {
    return [...tickets].sort((a, b) => {
      const upvoteDiff = this.upvoteCount(b) - this.upvoteCount(a);
      if (upvoteDiff !== 0) return upvoteDiff;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });
  }

  readonly allBacklogList = computed(() => this.sortTickets(this.currentTickets().filter((t) => t.status === 'backlog')));
  readonly backlogList = computed(() => {
    const filter = this.filterPriority();
    const list = this.allBacklogList();
    return filter === 'all' ? list : list.filter((t) => t.priority === filter);
  });
  readonly todoList = computed(() => this.sortTickets(this.currentTickets().filter((t) => t.status === 'todo')));
  readonly inProgressList = computed(() =>
    this.sortTickets(this.currentTickets().filter((t) => t.status === 'inprogress')),
  );
  readonly doneList = computed(() => this.sortTickets(this.currentTickets().filter((t) => t.status === 'done')));
  readonly resolvedList = computed(() => this.sortTickets(this.currentTickets().filter((t) => t.status === 'resolved')));

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

  readonly selectedTicket = linkedSignal(
    () => this.currentTickets().find((t) => t.id === this.selectedTicketId()) ?? null,
  );

  readonly releaseCanSubmit = computed(() => this.releaseForm().version.trim().length > 0);

  seedSelectedTicket(ticket: SerializedTicket): void {
    // untracked: même raison que seedTickets — lu depuis l'effect de la vue
    // détail, selectedTicketId ne doit pas en devenir une dépendance.
    if (untracked(this.selectedTicketId) !== ticket.id) return; // route déjà passée à autre chose
    this.selectedTicket.set(this.toClientTicket(ticket));
  }


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
    this.selectedBacklog.set(new Set());
    this.filterPriority.set('all');
    this.selectedTicketId.set(null);
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
        createdByUid: this.auth.user()?.uid,
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

  // Called on every board navigation so the ticket detail's back link can
  // return to whichever list the user actually came from, instead of
  // always falling back to the default child route (backlog).
  trackListRoute(url: string): void {
    if (url.includes('/kanban')) this.lastListRoute.set('kanban');
    else if (url.includes('/resolved')) this.lastListRoute.set('resolved');
    else if (url.includes('/backlog')) this.lastListRoute.set('backlog');
  }

  closeDetail(): void {
    this.selectedTicketId.set(null);
  }

  addComment(text: string): void {
    if (!this.requireRealUser(() => this.addComment(text))) return;
    const trimmed = text.trim();
    const ticket = this.selectedTicket();
    if (!trimmed || !ticket) return;
    const comments = [
      ...(ticket.comments ?? []),
      { author: this.auth.initials(), authorUid: this.auth.user()?.uid, text: trimmed, createdAt: Timestamp.now() },
    ];
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

  // Admin can edit any ticket/comment (unchanged elsewhere in this file);
  // a real user can additionally edit their own — matched by uid, not the
  // createdBy/author display string (which isn't a reliable identity: two
  // people can share the same initials). Tickets created before createdByUid
  // existed have no uid on file, so only admin can edit those. A locked
  // ticket can only be edited by an admin, regardless of ownership.
  canEditTicket(ticket: Ticket): boolean {
    if (ticket.locked) return this.isAdmin();
    return this.isAdmin() || (this.isRealUser() && !!ticket.createdByUid && ticket.createdByUid === this.auth.user()?.uid);
  }

  canEditComment(comment: Comment): boolean {
    return this.isAdmin() || (this.isRealUser() && !!comment.authorUid && comment.authorUid === this.auth.user()?.uid);
  }

  updateTicketDetails(
    id: string,
    changes: { title: string; description: string; priority: Priority; category: Category },
  ): void {
    const ticket = this.currentTickets().find((t) => t.id === id);
    if (!ticket || !this.canEditTicket(ticket)) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const title = changes.title.trim();
    if (!title) return;
    this.updateTicket(id, {
      title,
      description: changes.description.trim(),
      priority: changes.priority,
      category: changes.category,
    });
  }

  toggleLock(id: string): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const ticket = this.currentTickets().find((t) => t.id === id);
    if (!ticket) return;
    this.updateTicket(id, { locked: !ticket.locked });
  }

  returnToBacklog(id: string): void {
    if (!this.isAdmin()) {
      this.showToast('toast.notAuthorized');
      return;
    }
    this.updateTicket(id, { status: 'backlog' });
  }

  updateComment(index: number, text: string): void {
    const ticket = this.selectedTicket();
    const comment = ticket?.comments?.[index];
    if (!ticket || !comment || !this.canEditComment(comment)) {
      this.showToast('toast.notAuthorized');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    const comments = [...(ticket.comments ?? [])];
    comments[index] = { ...comment, text: trimmed };
    this.updateTicket(ticket.id, { comments });
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
