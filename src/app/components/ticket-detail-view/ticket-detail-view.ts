import { Component, computed, inject, signal } from '@angular/core';
import { TicketStore } from '../../services/ticket-store';
import { formatDate, formatDateTime } from '../../theme/format-date';
import { priorityLabel } from '../../theme/theme';

const STAGE_DEFS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'À faire' },
  { key: 'inprogress', label: 'En cours' },
  { key: 'done', label: 'Terminé' },
  { key: 'resolved', label: 'Résolu' },
] as const;

@Component({
  selector: 'app-ticket-detail-view',
  templateUrl: './ticket-detail-view.html',
  styleUrl: './ticket-detail-view.css',
})
export class TicketDetailView {
  protected readonly store = inject(TicketStore);
  protected readonly ticket = this.store.selectedTicket;

  protected readonly newCommentText = signal('');
  protected readonly newBugLinkDraft = signal('');

  protected readonly priorityLabel = priorityLabel;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;

  protected readonly stages = computed(() => {
    const ticket = this.ticket();
    if (!ticket) return [];
    const currentIndex = STAGE_DEFS.findIndex((s) => s.key === ticket.status);
    return STAGE_DEFS.map((stage, index) => ({
      label: stage.label,
      passed: index <= currentIndex,
      lineActive: index < currentIndex,
    }));
  });

  protected readonly canAdvance = computed(() => {
    const status = this.ticket()?.status;
    return status === 'todo' || status === 'inprogress';
  });
  protected readonly canAddToSprint = computed(() => this.ticket()?.status === 'backlog');
  protected readonly advanceLabel = computed(() =>
    this.ticket()?.status === 'todo' ? 'Passer en cours' : 'Marquer terminé',
  );

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
