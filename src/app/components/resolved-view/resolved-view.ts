import { Component, inject } from '@angular/core';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-resolved-view',
  templateUrl: './resolved-view.html',
  styleUrl: './resolved-view.css',
})
export class ResolvedView {
  protected readonly store = inject(TicketStore);
}
