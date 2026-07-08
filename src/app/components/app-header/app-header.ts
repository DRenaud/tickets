import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../services/auth-service';
import { TicketStore } from '../../services/ticket-store';
import { LanguageSwitcher } from '../language-switcher/language-switcher';

@Component({
  selector: 'app-header',
  imports: [RouterLink, TranslocoPipe, LanguageSwitcher],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
  protected readonly store = inject(TicketStore);
  private readonly auth = inject(AuthService);

  protected readonly projectMenuOpen = signal(false);
  protected readonly currentProjectLabel = computed(
    () => this.store.projects().find((p) => p.id === this.store.project())?.label ?? '',
  );
  protected readonly initials = this.auth.initials;
  protected readonly isRealUser = this.auth.isRealUser;

  toggleProjectMenu(): void {
    this.projectMenuOpen.update((v) => !v);
  }

  closeProjectMenu(): void {
    this.projectMenuOpen.set(false);
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  openLogin(): void {
    this.store.openLoginModal();
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
  }
}
