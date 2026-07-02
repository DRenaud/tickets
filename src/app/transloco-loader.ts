import { Service } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

@Service()
export class TranslocoImportLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    return import(`./i18n/${lang}.json`).then((m) => m.default);
  }
}
