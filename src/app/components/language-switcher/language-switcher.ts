import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppLang, LocaleService } from '../../services/locale-service';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslocoPipe],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.css',
})
export class LanguageSwitcher {
  protected readonly locale = inject(LocaleService);
  protected readonly langs: AppLang[] = ['fr', 'en'];
}
