// The interface text in every interface language: catalogs written in Links
// Notation (src/locales/app.lino) and read with @link-foundation/ui-i18n.

import { createLocalizer, readCatalogs } from '@link-foundation/ui-i18n';

export const interfaceLocales = ['en', 'ru', 'de', 'fr', 'es', 'zh', 'hi'];

// Each language named in itself, so a reader finds their own.
export const localeNames = {
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  zh: '中文',
  hi: 'हिन्दी',
};

const panelKeys = [
  'settings',
  'close',
  'search',
  'randomize',
  'resetAll',
  'confirmReset',
  'share',
  'copyChanges',
  'pasteChanges',
  'reset',
  'changed',
  'count',
];

// The locale to show: the one chosen in the settings, or the first browser
// language the interface is written in.
export function interfaceLocale(choice, browserLanguages = []) {
  if (interfaceLocales.includes(choice)) {
    return choice;
  }
  for (const language of browserLanguages) {
    const code = String(language).toLowerCase().split('-')[0];
    if (interfaceLocales.includes(code)) {
      return code;
    }
  }
  return 'en';
}

// { locale, direction, t(key, params), panelMessages }
export function createInterfaceText(catalogText, locale) {
  const localizer = createLocalizer({
    catalogs: readCatalogs(catalogText),
    languages: [locale],
    defaultLocale: 'en',
  });
  localizer.setLocale(locale);
  const t = (key, params = {}) =>
    localizer.text({ type: 'message', key, params });
  return {
    locale: localizer.locale(),
    direction: localizer.direction(),
    t,
    // Messages of the settings panel (ui-components), with parameters.
    panelMessages: Object.fromEntries(
      panelKeys.map((key) => [key, (params) => t(`panel.${key}`, params)])
    ),
  };
}
