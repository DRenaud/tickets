import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Category, NewTicketForm, Priority } from '../../models/ticket.model';
import { TicketStore } from '../../services/ticket-store';

function emptyForm(): NewTicketForm {
  return { title: '', description: '', priority: 'medium', category: 'bug' };
}

@Component({
  selector: 'app-new-ticket-modal',
  imports: [FormField],
  templateUrl: './new-ticket-modal.html',
  styleUrl: './new-ticket-modal.css',
})
export class NewTicketModal {
  protected readonly store = inject(TicketStore);

  private readonly model = signal<NewTicketForm>(emptyForm());
  protected readonly ticketForm = form(this.model);

  protected readonly priorityOptions: { key: Priority; label: string }[] = [
    { key: 'low', label: 'Basse' },
    { key: 'medium', label: 'Moyenne' },
    { key: 'high', label: 'Haute' },
  ];
  protected readonly categoryOptions: Category[] = ['bug', 'idea', 'design', 'tech'];

  protected readonly priority = computed(() => this.model().priority);
  protected readonly category = computed(() => this.model().category);
  protected readonly canSubmit = computed(() => this.model().title.trim().length > 0);

  categoryMeta(c: Category) {
    return this.store.categoryMeta(c);
  }

  setPriority(p: Priority): void {
    this.model.update((m) => ({ ...m, priority: p }));
  }

  setCategory(c: Category): void {
    this.model.update((m) => ({ ...m, category: c }));
  }

  close(): void {
    this.store.closeNewTicket();
    this.model.set(emptyForm());
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.store.submitNewTicket(this.model());
    this.model.set(emptyForm());
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
