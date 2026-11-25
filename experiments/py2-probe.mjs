import { translate } from '../js/src/index.js';
for (const source of process.argv.slice(2)) {
  try {
    console.log(translate(`${source}\n`, 'python', 'javascript'));
  } catch (error) {
    console.log('ERROR', error.message);
  }
}
