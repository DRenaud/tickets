import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase.config';

@Injectable({ providedIn: 'root' })
export class FirebaseAppService {
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly app: FirebaseApp | null = this.isBrowser ? initializeApp(firebaseConfig) : null;
}
