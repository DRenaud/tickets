import { Component, inject } from '@angular/core';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-stats-bar',
  templateUrl: './stats-bar.html',
  styleUrl: './stats-bar.css',
})
export class StatsBar {
  protected readonly store = inject(TicketStore);
}
