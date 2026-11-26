// The settings behind the small link at the bottom: skin (a theme of
// @link-foundation/ui-themes), light or dark scheme, contrast, motion, text
// size, the editor (plain or Monaco), word wrap and the interface language.
// The schema is Links Notation for
// @link-foundation/ui-settings; the values are kept in the browser storage,
// can be shared with a "#settings=…" link and are painted on the root
// element as data attributes and CSS variables.

import {
  applyToRoot,
  defaults,
  fromLino,
  fromShareHash,
  readSchema,
  toLino,
} from '@link-foundation/ui-settings';
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';
import { interfaceLocales, localeNames } from './i18n.js';

export const settingsKey = 'universal-translator.settings';

// The app's own look; every other skin comes from ui-themes.
export const ownTheme = 'app';
export const themeIds = () => [ownTheme, ...listThemes()];

const quote = (text) =>
  text.includes("'") ? `"${text.replaceAll('"', '”')}"` : `'${text}'`;

const optionLabels = (pairs) =>
  `(option-labels ${pairs
    .map(([value, label]) => `(${value} ${quote(label)})`)
    .join(' ')})`;

const themeLabel = (id) =>
  id
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');

// The schema with labels in the interface language (t reads the catalog).
export function settingsSchemaText(t) {
  const choices = (...values) =>
    optionLabels(values.map((value) => [value, t(`choice.${value}`)]));
  const field = (key, parts) => `(${key}: ${parts.filter(Boolean).join(' ')})`;
  return [
    '(settings: schema (version 1))',
    `(look: section (label ${quote(t('settings.look'))}))`,
    `(text: section (label ${quote(t('settings.text'))}))`,
    `(language: section (label ${quote(t('settings.language'))}))`,
    field('theme', [
      '(type choice)',
      `(default ${ownTheme})`,
      `(options ${themeIds().join(' ')})`,
      optionLabels(
        themeIds().map((id) => [
          id,
          id === ownTheme ? t('choice.app') : themeLabel(id),
        ])
      ),
      '(section look)',
      `(label ${quote(t('settings.skin'))})`,
      '(apply (data-attr theme))',
    ]),
    field('scheme', [
      '(type choice)',
      '(default system)',
      '(options system light dark)',
      choices('system', 'light', 'dark'),
      '(section look)',
      `(label ${quote(t('settings.scheme'))})`,
      '(apply (data-attr scheme))',
    ]),
    field('contrast', [
      '(type choice)',
      '(default system)',
      '(options system normal more)',
      choices('system', 'normal', 'more'),
      '(section look)',
      `(label ${quote(t('settings.contrast'))})`,
      '(apply (data-attr contrast))',
    ]),
    field('motion', [
      '(type choice)',
      '(default system)',
      '(options system full reduced)',
      choices('system', 'full', 'reduced'),
      '(section look)',
      `(label ${quote(t('settings.motion'))})`,
      '(comfort)',
      '(apply (data-attr motion))',
    ]),
    field('text-size', [
      '(type range)',
      '(default 16)',
      '(min 12)',
      '(max 24)',
      '(step 1)',
      '(unit px)',
      '(section text)',
      `(label ${quote(t('settings.textSize'))})`,
      '(comfort)',
      '(apply (css-var --text-size))',
    ]),
    field('editor', [
      '(type choice)',
      '(default monaco)',
      '(options monaco plain)',
      choices('monaco', 'plain'),
      '(section text)',
      `(label ${quote(t('settings.editor'))})`,
      '(apply (data-attr editor))',
    ]),
    field('wrap', [
      '(type toggle)',
      '(default true)',
      '(section text)',
      `(label ${quote(t('settings.wrap'))})`,
      '(apply (data-attr wrap))',
    ]),
    field('locale', [
      '(type choice)',
      '(default auto)',
      `(options auto ${interfaceLocales.join(' ')})`,
      optionLabels([
        ['auto', t('choice.auto')],
        ...interfaceLocales.map((code) => [code, localeNames[code]]),
      ]),
      '(section language)',
      `(label ${quote(t('settings.locale'))})`,
      '(apply (data-attr locale))',
    ]),
  ].join('\n');
}

export function settingsSchema(t) {
  const { schema, diagnostics } = readSchema(settingsSchemaText(t));
  const errors = diagnostics.filter((it) => it.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((it) => it.message).join('; '));
  }
  return schema;
}

// The values to start with: a shared link first, then the saved ones.
export function initialSettings(schema, { storage, hash = '' } = {}) {
  if (hash.includes('settings=')) {
    const shared = fromShareHash(schema, hash);
    if (shared.ok) {
      return { ...defaults(schema), ...shared.values };
    }
  }
  try {
    const saved = storage?.getItem(settingsKey);
    if (saved) {
      return { ...defaults(schema), ...fromLino(schema, saved).values };
    }
  } catch {
    // Unreadable settings: start from the defaults.
  }
  return defaults(schema);
}

export function saveSettings(schema, values, storage) {
  try {
    storage?.setItem(settingsKey, toLino(schema, values));
  } catch {
    // The settings last for this visit only.
  }
}

// The CSS of a ui-themes skin, loaded once per skin.
const themeCss = new Map();
async function cssOf(id) {
  if (!themeCss.has(id)) {
    themeCss.set(
      id,
      loadTheme(id).then((theme) => compileThemeCss(theme))
    );
  }
  try {
    return await themeCss.get(id);
  } catch (error) {
    themeCss.delete(id);
    throw error;
  }
}

// Paint the values on the root element and load the stylesheet of the skin.
export async function applySettings(schema, values, doc = globalThis.document) {
  const root = doc.documentElement;
  applyToRoot(schema, values, root);
  let style = doc.getElementById('ui-theme');
  if (values.theme === ownTheme) {
    style?.remove();
    return;
  }
  const css = await cssOf(values.theme);
  style ??= doc.head.appendChild(doc.createElement('style'));
  style.id = 'ui-theme';
  style.textContent = css;
}
