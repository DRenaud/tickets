import { DOCUMENT, Service, afterNextRender, inject, signal } from '@angular/core';
import { arrayUnion, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { ProjectId } from '../models/ticket.model';
import { AuthService } from './auth-service';
import { FirebaseAppService } from './firebase-app';

const STORAGE_KEY = 'fastticket.knownProjects';

/**
 * Tracks which projects this visitor has "discovered" (opened via a direct
 * link at least once), so the project switcher only lists those instead of
 * every project that exists. Anonymous sessions keep the list in
 * localStorage only; real accounts also mirror it to their Firestore
 * `users/{uid}` doc so it follows them across devices.
 */
@Service()
export class ProjectAccessService {
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthService);
  private readonly firebaseApp = inject(FirebaseAppService);

  private readonly known = signal<ReadonlySet<ProjectId>>(new Set());
  readonly knownProjectIds = this.known.asReadonly();

  constructor() {
    // Browser-only, after hydration: seeding from localStorage earlier
    // would mismatch the server-rendered HTML (NG0500), same reasoning as
    // LocaleService.
    afterNextRender(() => {
      this.known.set(this.readLocal());
      void this.auth.whenReady().then(() => {
        if (this.auth.isRealUser()) void this.pullRemote();
      });
    });
  }

  markVisited(id: ProjectId): void {
    // Re-read localStorage instead of trusting the (possibly not-yet-hydrated)
    // signal, so this can't clobber a list it raced with afterNextRender to load.
    const next = this.readLocal();
    const alreadyKnown = next.has(id);
    next.add(id);
    this.known.set(next);
    if (alreadyKnown) return;
    this.writeLocal(next);
    if (this.auth.isRealUser()) void this.pushRemote(id);
  }

  async onLoginSuccess(): Promise<void> {
    await this.pullRemote();
    for (const id of this.known()) {
      void this.pushRemote(id);
    }
  }

  private readLocal(): Set<ProjectId> {
    const raw = this.document.defaultView?.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw) as ProjectId[]);
    } catch {
      return new Set();
    }
  }

  private writeLocal(ids: ReadonlySet<ProjectId>): void {
    this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  }

  private async pullRemote(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid || !this.firebaseApp.app) return;
    const ref = doc(getFirestore(this.firebaseApp.app), 'users', uid);
    const snap = await getDoc(ref).catch(() => null);
    const remote = (snap?.data()?.['knownProjects'] as ProjectId[] | undefined) ?? [];
    if (!remote.length) return;
    const next = new Set(this.known());
    remote.forEach((id) => next.add(id));
    this.known.set(next);
    this.writeLocal(next);
  }

  private async pushRemote(id: ProjectId): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid || !this.firebaseApp.app) return;
    const ref = doc(getFirestore(this.firebaseApp.app), 'users', uid);
    await setDoc(ref, { knownProjects: arrayUnion(id) }, { merge: true }).catch(() => {});
  }
}
