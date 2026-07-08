import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Timestamp } from 'firebase/firestore';
import { AppLang, LocaleService } from '../../services/locale-service';
import { TicketStore } from '../../services/ticket-store';
import { formatDate, formatDateTime } from '../../theme/format-date';
import { priorityLabelKey } from '../../theme/theme';

const STAGE_DEFS = [
  { key: 'backlog', labelKey: 'status.backlog' },
  { key: 'todo', labelKey: 'status.todo' },
  { key: 'inprogress', labelKey: 'status.inprogress' },
  { key: 'done', labelKey: 'status.done' },
  { key: 'resolved', labelKey: 'status.resolved' },
] as const;

const DATE_LOCALES: Record<AppLang, string> = { fr: 'fr-FR', en: 'en-US' };

@Component({
  selector: 'app-ticket-detail-view',
  imports: [TranslocoPipe],
  templateUrl: './ticket-detail-view.html',
  styleUrl: './ticket-detail-view.css',
})
export class TicketDetailView {
  protected readonly store = inject(TicketStore);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly ticket = this.store.selectedTicket;

  readonly ticketId = input.required<string>();

  protected readonly newCommentText = signal('');
  protected readonly newBugLinkDraft = signal('');

  protected readonly priorityLabelKey = priorityLabelKey;
  private readonly dateLocale = computed(() => DATE_LOCALES[this.locale.lang()]);

  constructor() {
    effect(() => this.store.openDetail(this.ticketId()));
  }

  protected readonly stages = computed(() => {
    const ticket = this.ticket();
    if (!ticket) return [];
    const currentIndex = STAGE_DEFS.findIndex((s) => s.key === ticket.status);
    return STAGE_DEFS.map((stage, index) => ({
      labelKey: stage.labelKey,
      passed: index <= currentIndex,
      lineActive: index < currentIndex,
    }));
  });

  protected readonly canAdvance = computed(() => {
    const status = this.ticket()?.status;
    return status === 'todo' || status === 'inprogress';
  });
  protected readonly canAddToSprint = computed(() => this.ticket()?.status === 'backlog');
  protected readonly advanceLabelKey = computed(() =>
    this.ticket()?.status === 'todo' ? 'detail.moveToInProgress' : 'detail.markDone',
  );

  formatDate(timestamp: Timestamp | undefined): string {
    return formatDate(timestamp, this.dateLocale());
  }

  formatDateTime(timestamp: Timestamp | undefined): string {
    return formatDateTime(timestamp, this.dateLocale());
  }

  back(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  submitComment(): void {
    if (!this.newCommentText().trim()) return;
    const wasRealUser = this.store.isRealUser();
    this.store.addComment(this.newCommentText());
    // Same reasoning as NewTicketModal.submit(): don't clear a comment
    // that's still pending the login modal / retry.
    if (wasRealUser) this.newCommentText.set('');
  }

  onPrLinkChange(value: string): void {
    this.store.updatePrLink(value);
  }

  submitBugLink(): void {
    if (!this.newBugLinkDraft().trim()) return;
    this.store.addBugLink(this.newBugLinkDraft());
    this.newBugLinkDraft.set('');
  }

  removeBugLink(index: number): void {
    this.store.removeBugLink(index);
  }

  removeComment(index: number): void {
    this.store.removeComment(index);
  }

  deleteTicket(): void {
    const ticket = this.ticket();
    if (!ticket) return;
    if (!confirm(this.transloco.translate('detail.confirmDeleteTicket'))) return;
    this.store.deleteTicket(ticket.id);
    this.back();
  }

  onTimeSpentChange(value: string): void {
    const minutes = Number(value);
    this.store.updateTimeSpent(Number.isFinite(minutes) ? minutes : 0);
  }

  advance(): void {
    const id = this.ticket()?.id;
    if (id) this.store.advanceTicket(id);
  }

  addToSprint(): void {
    const id = this.ticket()?.id;
    if (id) this.store.addFromBacklogToSprint(id);
  }
}
