import { DOCUMENT, Service, afterNextRender, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const STORAGE_KEY = 'fastticket.lang';

export type AppLang = 'fr' | 'en';

@Service()
export class LocaleService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly lang = signal<AppLang>('fr');

  constructor() {
    // Browser-only, after hydration: applying the stored language earlier
    // would mismatch the French prerendered HTML (NG0500).
    afterNextRender(() => {
      const stored = this.document.defaultView?.localStorage?.getItem(STORAGE_KEY);
      if (stored === 'fr' || stored === 'en') {
        this.apply(stored, false);
      }
    });
  }

  setLang(lang: AppLang): void {
    this.apply(lang, true);
  }

  private apply(lang: AppLang, persist: boolean): void {
    this.lang.set(lang);
    this.transloco.setActiveLang(lang);
    this.document.documentElement.lang = lang;
    if (persist) {
      this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, lang);
    }
  }
}
