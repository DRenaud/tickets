import { Component, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../services/auth-service';
import { TicketStore } from '../../services/ticket-store';

interface Credentials {
  email: string;
  password: string;
}

type Mode = 'signin' | 'signup';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/user-disabled': 'Ce compte a été désactivé.',
  'auth/user-not-found': 'Aucun compte ne correspond à cet e-mail.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail.',
  'auth/weak-password': 'Mot de passe trop faible (6 caractères minimum).',
  'auth/popup-closed-by-user': 'Fenêtre Google fermée avant la fin de la connexion.',
  'auth/network-request-failed': 'Problème réseau, réessaie.',
};

function describeError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return ERROR_MESSAGES[error.code] ?? 'Une erreur est survenue. Réessaie.';
  }
  return 'Une erreur est survenue. Réessaie.';
}

@Component({
  selector: 'app-login-page',
  imports: [FormField],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  protected readonly store = inject(TicketStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('signin');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly model = signal<Credentials>({ email: '', password: '' });
  protected readonly credentialsForm = form(this.model);

  toggleMode(): void {
    this.mode.set(this.mode() === 'signin' ? 'signup' : 'signin');
    this.errorMessage.set(null);
  }

  async submit(): Promise<void> {
    const { email, password } = this.model();
    if (!email.trim() || password.length < 6 || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      if (this.mode() === 'signin') {
        await this.auth.signInWithEmail(email.trim(), password);
      } else {
        await this.auth.signUpWithEmail(email.trim(), password);
      }
      await this.router.navigateByUrl('/alveola');
    } catch (error) {
      this.errorMessage.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }

  async continueWithGoogle(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/alveola');
    } catch (error) {
      this.errorMessage.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
