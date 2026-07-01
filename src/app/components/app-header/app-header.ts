import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
  protected readonly store = inject(TicketStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    const source = user?.displayName?.trim() || user?.email?.trim() || '';
    if (!source) return '?';
    const parts = source.includes('@') ? [source.split('@')[0]] : source.split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  });

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
