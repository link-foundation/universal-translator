import { describe, expect, it } from 'test-anywhere';
import { issueReportUrl } from '../../examples/universal-app/src/report-issue.js';

describe('translation issue reporting', () => {
  it('prefills the source, language choices, options, rules and actual errors', () => {
    const source = '// Привет & hello?\nconsole.log(```);\n';
    const url = new URL(
      issueReportUrl(
        'https://github.com/link-foundation/universal-translator/',
        {
          source,
          from: 'auto',
          to: 'python',
          fragment: true,
          commentLanguage: 'english',
          rules: { names: [{ find: 'hello', replace: 'greeting' }] },
        },
        {
          output: '# incomplete',
          detected: 'javascript',
          errors: [{ line: 2, message: 'Unexpected token' }],
        }
      )
    );
    expect(url.pathname).toBe(
      '/link-foundation/universal-translator/issues/new'
    );
    expect(url.searchParams.get('title')).toBe(
      'Translation issue: auto → python'
    );
    const body = url.searchParams.get('body');
    expect(body).toContain(source);
    expect(body).toContain('````\n');
    expect(body).toContain('fragment: true');
    expect(body).toContain('commentLanguage: english');
    expect(body).toContain('Detected source language: javascript');
    expect(body).toContain('Line 2: Unexpected token');
    expect(body).toContain('# incomplete');
    expect(body).toContain('greeting');
  });

  it('includes a translation failure when no output was produced', () => {
    const body = new URL(
      issueReportUrl(
        'https://github.com/link-foundation/universal-translator',
        { source: 'x', from: 'python', to: 'rust' },
        { error: 'Cannot read source' }
      )
    ).searchParams.get('body');
    expect(body).toContain('Cannot read source');
  });
});
