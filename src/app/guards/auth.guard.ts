import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth-service';

export const authReadyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.whenReady();
  return true;
};
