// Probe the link-foundation/ui packages the example app's settings use.
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';
import * as i18n from '@link-foundation/ui-i18n';
import * as settings from '@link-foundation/ui-settings';

const themes = listThemes();
console.log(
  'themes',
  themes.length,
  JSON.stringify(themes.slice(0, 3)).slice(0, 400)
);
const base = await loadTheme('base');
const css = compileThemeCss(base);
console.log('css', typeof css, String(css.css ?? css).slice(0, 900));
console.log('i18n', Object.keys(i18n).join(' '));
console.log('settings', Object.keys(settings).join(' '));
