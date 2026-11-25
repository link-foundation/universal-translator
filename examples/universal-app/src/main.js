import { StrictMode, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import catalogText from './locales/app.lino?raw';
import { createInterfaceText } from './i18n.js';
import { applySettings, initialSettings, settingsSchema } from './settings.js';
import { defaultStorage, loadSavedStandards } from './saved-standards.js';
import './styles.css';

// The standards one saved are languages too: register them first.
const storage = defaultStorage();
for (const failed of loadSavedStandards(storage)) {
  console.warn(`The standard ${failed.id} could not be read: ${failed.error}`);
}

// Paint the settings (from a shared link or the storage) before rendering.
const schema = settingsSchema(createInterfaceText(catalogText, 'en').t);
const settings = initialSettings(schema, {
  storage,
  hash: globalThis.location?.hash ?? '',
});
applySettings(schema, settings).catch((error) => console.warn(error));

createRoot(document.getElementById('root')).render(
  h(StrictMode, null, h(App, { initialSettings: settings }))
);
