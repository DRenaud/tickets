import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-toast-notification',
  imports: [TranslocoPipe],
  templateUrl: './toast-notification.html',
  styleUrl: './toast-notification.css',
})
export class ToastNotification {
  protected readonly store = inject(TicketStore);
}
