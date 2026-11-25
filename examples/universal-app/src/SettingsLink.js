// The small "Settings" link at the bottom of the page: it opens the
// settings panel of @link-foundation/ui-components as a drawer.

import { createElement as h, useEffect, useRef } from 'react';
import { createSettingsPanel } from '@link-foundation/ui-components/settings';
import '@link-foundation/ui-components/controls.css';
import '@link-foundation/ui-components/settings.css';

export function SettingsLink({ schema, values, messages, label, onChange }) {
  const panel = useRef();
  const latest = useRef(onChange);
  latest.current = onChange;

  // A new schema (the labels of another interface language) needs a new
  // panel; the values it shows are the current ones.
  useEffect(() => {
    const created = createSettingsPanel(schema, {
      values,
      mode: 'drawer',
      messages,
      label,
      onChange: (next) => latest.current(next),
    });
    created.element.id = 'settings-panel';
    document.body.appendChild(created.element);
    panel.current = created;
    return () => {
      created.destroy();
      panel.current = undefined;
    };
    // An open panel keeps the values it shows.
  }, [schema]);

  return h(
    'button',
    {
      id: 'settings-link',
      type: 'button',
      className: 'settings-link',
      onClick: (event) => panel.current?.open(event.currentTarget),
    },
    label
  );
}
