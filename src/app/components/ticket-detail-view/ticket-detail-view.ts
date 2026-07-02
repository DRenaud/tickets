import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
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
  protected readonly ticket = this.store.selectedTicket;

  protected readonly newCommentText = signal('');
  protected readonly newBugLinkDraft = signal('');

  protected readonly priorityLabelKey = priorityLabelKey;
  private readonly dateLocale = computed(() => DATE_LOCALES[this.locale.lang()]);

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
    this.store.closeDetail();
  }

  submitComment(): void {
    if (!this.newCommentText().trim()) return;
    this.store.addComment(this.newCommentText());
    this.newCommentText.set('');
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
