import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
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
import { firebaseConfig } from '../firebase.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private auth: Auth | null = null;
  private readonly readyPromise: Promise<void>;

  readonly user = signal<User | null>(null);
  readonly initialized = signal(false);
  readonly isAuthenticated = computed(() => this.user() !== null);

  constructor() {
    if (!this.isBrowser) {
      this.initialized.set(true);
      this.readyPromise = Promise.resolve();
      return;
    }

    const app: FirebaseApp = initializeApp(firebaseConfig);
    this.auth = getAuth(app);

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
