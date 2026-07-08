import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { FirebaseAppService } from './firebase-app';

const ADMIN_EMAIL = 'contact@damien-renaud.com';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseApp = inject(FirebaseAppService);
  private auth: Auth | null = null;
  private readonly readyPromise: Promise<void>;

  readonly user = signal<User | null>(null);
  readonly initialized = signal(false);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAnonymous = computed(() => this.user()?.isAnonymous === true);
  readonly isRealUser = computed(() => this.isAuthenticated() && !this.isAnonymous());
  readonly isAdmin = computed(() => this.user()?.email === ADMIN_EMAIL);

  readonly initials = computed(() => {
    const user = this.user();
    const source = user?.displayName?.trim() || user?.email?.trim() || '';
    if (!source) return '?';
    const parts = source.includes('@') ? [source.split('@')[0]] : source.split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  });

  constructor() {
    if (!this.firebaseApp.app) {
      this.initialized.set(true);
      this.readyPromise = Promise.resolve();
      return;
    }

    this.auth = getAuth(this.firebaseApp.app);

    this.readyPromise = new Promise((resolve) => {
      onAuthStateChanged(this.auth!, (user) => {
        if (!user) {
          // No session yet: start an anonymous one so browsing works without
          // an account. Wait for the next callback (with the anonymous user)
          // before resolving, to avoid a brief "signed out" flash.
          signInAnonymously(this.auth!).catch(() => {
            this.user.set(null);
            if (!this.initialized()) {
              this.initialized.set(true);
              resolve();
            }
          });
          return;
        }
        this.user.set(user);
        if (!this.initialized()) {
          this.initialized.set(true);
          resolve();
        }
      });
    });
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    if (!this.auth) return;
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async signUpWithEmail(email: string, password: string): Promise<void> {
    if (!this.auth) return;
    await createUserWithEmailAndPassword(this.auth, email, password);
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.auth) return;
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    if (!this.auth) return;
    await firebaseSignOut(this.auth);
  }
}
