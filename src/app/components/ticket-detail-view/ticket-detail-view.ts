import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketComments } from '../ticket-comments/ticket-comments';
import { TicketSidebar } from '../ticket-sidebar/ticket-sidebar';
import { TicketStore } from '../../services/ticket-store';
import type { SerializedTicket } from '../../models/ticket.model';

const STAGE_DEFS = [
  { key: 'backlog', labelKey: 'status.backlog' },
  { key: 'todo', labelKey: 'status.todo' },
  { key: 'inprogress', labelKey: 'status.inprogress' },
  { key: 'done', labelKey: 'status.done' },
  { key: 'resolved', labelKey: 'status.resolved' },
] as const;

@Component({
  selector: 'app-ticket-detail-view',
  imports: [TranslocoPipe, TicketComments, TicketSidebar],
  templateUrl: './ticket-detail-view.html',
  styleUrl: './ticket-detail-view.css',
})
export class TicketDetailView {
  protected readonly store = inject(TicketStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly ticket = this.store.selectedTicket;

  readonly ticketId = input.required<string>();
  readonly initialTicketDetail = input<SerializedTicket | null>(null);

  protected readonly editingTicket = signal(false);
  protected readonly editTitleDraft = signal('');
  protected readonly editDescriptionDraft = signal('');

  constructor() {
    effect(() => {
      const id = this.ticketId();
      this.store.openDetail(id);
      const detail = this.initialTicketDetail();
      if (detail && detail.id === id) {
        this.store.seedSelectedTicket(detail);
      }
    });
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

  back(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  startEditTicket(): void {
    const t = this.ticket();
    if (!t) return;
    this.editTitleDraft.set(t.title);
    this.editDescriptionDraft.set(t.description ?? '');
    this.editingTicket.set(true);
  }

  cancelEditTicket(): void {
    this.editingTicket.set(false);
  }

  saveEditTicket(): void {
    const t = this.ticket();
    if (!t) return;
    this.store.updateTicketDetails(t.id, { title: this.editTitleDraft(), description: this.editDescriptionDraft() });
    this.editingTicket.set(false);
  }
}
