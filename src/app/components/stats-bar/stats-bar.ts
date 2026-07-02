import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-stats-bar',
  imports: [TranslocoPipe],
  templateUrl: './stats-bar.html',
  styleUrl: './stats-bar.css',
})
export class StatsBar {
  protected readonly store = inject(TicketStore);
}
