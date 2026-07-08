import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Timestamp } from 'firebase/firestore';
import { AppLang, LocaleService } from '../../services/locale-service';
import { TicketStore } from '../../services/ticket-store';
import { Ticket } from '../../models/ticket.model';
import { formatDateTime } from '../../theme/format-date';

const DATE_LOCALES: Record<AppLang, string> = { fr: 'fr-FR', en: 'en-US' };

@Component({
  selector: 'app-ticket-comments',
  imports: [TranslocoPipe],
  templateUrl: './ticket-comments.html',
  styleUrl: './ticket-comments.css',
})
export class TicketComments {
  protected readonly store = inject(TicketStore);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);

  readonly ticket = input.required<Ticket>();

  protected readonly newCommentText = signal('');
  protected readonly editingCommentIndex = signal<number | null>(null);
  protected readonly editCommentDraft = signal('');

  private readonly dateLocale = computed(() => DATE_LOCALES[this.locale.lang()]);

  formatDateTime(timestamp: Timestamp | undefined): string {
    return formatDateTime(timestamp, this.dateLocale());
  }

  submitComment(): void {
    if (!this.newCommentText().trim()) return;
    const wasRealUser = this.store.isRealUser();
    this.store.addComment(this.newCommentText());
    // Same reasoning as NewTicketModal.submit(): don't clear a comment
    // that's still pending the login modal / retry.
    if (wasRealUser) this.newCommentText.set('');
  }

  removeComment(index: number): void {
    if (!confirm(this.transloco.translate('detail.confirmRemoveComment'))) return;
    this.store.removeComment(index);
  }

  startEditComment(index: number, text: string): void {
    this.editCommentDraft.set(text);
    this.editingCommentIndex.set(index);
  }

  cancelEditComment(): void {
    this.editingCommentIndex.set(null);
  }

  saveEditComment(index: number): void {
    if (!this.editCommentDraft().trim()) return;
    this.store.updateComment(index, this.editCommentDraft());
    this.editingCommentIndex.set(null);
  }
}
