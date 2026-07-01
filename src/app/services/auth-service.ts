import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { FirebaseAppService } from './firebase-app';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseApp = inject(FirebaseAppService);
  private auth: Auth | null = null;
  private readonly readyPromise: Promise<void>;

  readonly user = signal<User | null>(null);
  readonly initialized = signal(false);
  readonly isAuthenticated = computed(() => this.user() !== null);

  constructor() {
    if (!this.firebaseApp.app) {
      this.initialized.set(true);
      this.readyPromise = Promise.resolve();
      return;
    }

    this.auth = getAuth(this.firebaseApp.app);

    this.readyPromise = new Promise((resolve) => {
      onAuthStateChanged(this.auth!, (user) => {
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
