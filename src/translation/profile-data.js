import machine from './machine.json' with { type: 'json' };
import managed from './managed.json' with { type: 'json' };
import scripts from './scripts.json' with { type: 'json' };
import systems from './systems.json' with { type: 'json' };

export default () => [...systems, ...managed, ...scripts, ...machine];
