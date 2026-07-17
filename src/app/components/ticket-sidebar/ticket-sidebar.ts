import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Timestamp } from 'firebase/firestore';
import { AppLang, LocaleService } from '../../services/locale-service';
import { TicketStore } from '../../services/ticket-store';
import { Ticket } from '../../models/ticket.model';
import { formatDate } from '../../theme/format-date';
import { priorityLabelKey } from '../../theme/theme';

const DATE_LOCALES: Record<AppLang, string> = { fr: 'fr-FR', en: 'en-US' };

@Component({
  selector: 'app-ticket-sidebar',
  imports: [TranslocoPipe],
  templateUrl: './ticket-sidebar.html',
  styleUrl: './ticket-sidebar.css',
})
export class TicketSidebar {
  protected readonly store = inject(TicketStore);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly ticket = input.required<Ticket>();

  protected readonly newBugLinkDraft = signal('');
  protected readonly priorityLabelKey = priorityLabelKey;

  private readonly dateLocale = computed(() => DATE_LOCALES[this.locale.lang()]);

  protected readonly canAdvance = computed(() => {
    const status = this.ticket().status;
    return status === 'todo' || status === 'inprogress';
  });
  protected readonly canAddToSprint = computed(() => this.ticket().status === 'backlog');
  protected readonly canReturnToBacklog = computed(() => this.ticket().status !== 'backlog');
  protected readonly isLocked = computed(() => !!this.ticket().locked);
  protected readonly advanceLabelKey = computed(() =>
    this.ticket().status === 'todo' ? 'detail.moveToInProgress' : 'detail.markDone',
  );

  formatDate(timestamp: Timestamp | undefined): string {
    return formatDate(timestamp, this.dateLocale());
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
    if (!confirm(this.transloco.translate('detail.confirmRemoveBugReport'))) return;
    this.store.removeBugLink(index);
  }

  onTimeSpentChange(value: string): void {
    const minutes = Number(value);
    this.store.updateTimeSpent(Number.isFinite(minutes) ? minutes : 0);
  }

  advance(): void {
    this.store.advanceTicket(this.ticket().id);
  }

  addToSprint(): void {
    this.store.addFromBacklogToSprint(this.ticket().id);
  }

  returnToBacklog(): void {
    this.store.returnToBacklog(this.ticket().id);
  }

  toggleLock(): void {
    this.store.toggleLock(this.ticket().id);
  }

  deleteTicket(): void {
    if (!confirm(this.transloco.translate('detail.confirmDeleteTicket'))) return;
    this.store.deleteTicket(this.ticket().id);
    this.router.navigate(['..'], { relativeTo: this.route });
  }
}
