import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase.config';

@Service()
export class FirebaseAppService {
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly app: FirebaseApp | null = this.isBrowser ? initializeApp(firebaseConfig) : null;
}
