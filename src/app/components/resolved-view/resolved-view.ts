import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-resolved-view',
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './resolved-view.html',
  styleUrl: './resolved-view.css',
})
export class ResolvedView {
  protected readonly store = inject(TicketStore);
}
