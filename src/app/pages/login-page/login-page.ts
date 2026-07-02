import { Component, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { FirebaseError } from 'firebase/app';
import { LanguageSwitcher } from '../../components/language-switcher/language-switcher';
import { AuthService } from '../../services/auth-service';
import { TicketStore } from '../../services/ticket-store';

interface Credentials {
  email: string;
  password: string;
}

type Mode = 'signin' | 'signup';

const ERROR_KEYS: Record<string, string> = {
  'auth/invalid-email': 'login.errors.invalidEmail',
  'auth/user-disabled': 'login.errors.userDisabled',
  'auth/user-not-found': 'login.errors.userNotFound',
  'auth/wrong-password': 'login.errors.wrongPassword',
  'auth/invalid-credential': 'login.errors.invalidCredential',
  'auth/email-already-in-use': 'login.errors.emailInUse',
  'auth/weak-password': 'login.errors.weakPassword',
  'auth/popup-closed-by-user': 'login.errors.popupClosed',
  'auth/network-request-failed': 'login.errors.network',
};

function describeError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return ERROR_KEYS[error.code] ?? 'login.errors.unknown';
  }
  return 'login.errors.unknown';
}

@Component({
  selector: 'app-login-page',
  imports: [FormField, TranslocoPipe, LanguageSwitcher],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  protected readonly store = inject(TicketStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('signin');
  protected readonly loading = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  private readonly model = signal<Credentials>({ email: '', password: '' });
  protected readonly credentialsForm = form(this.model);

  toggleMode(): void {
    this.mode.set(this.mode() === 'signin' ? 'signup' : 'signin');
    this.errorKey.set(null);
  }

  async submit(): Promise<void> {
    const { email, password } = this.model();
    if (!email.trim() || password.length < 6 || this.loading()) return;

    this.loading.set(true);
    this.errorKey.set(null);
    try {
      if (this.mode() === 'signin') {
        await this.auth.signInWithEmail(email.trim(), password);
      } else {
        await this.auth.signUpWithEmail(email.trim(), password);
      }
      await this.router.navigateByUrl('/alveola');
    } catch (error) {
      this.errorKey.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }

  async continueWithGoogle(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorKey.set(null);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/alveola');
    } catch (error) {
      this.errorKey.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
