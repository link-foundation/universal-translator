"""Preserve GitHub requirements and attachments for the issue-16 case study."""
import json
import pathlib
import re
import subprocess

root = pathlib.Path('docs/case-studies/issue-16/data')
items = json.loads((root / 'all-issues-and-prs.json').read_text())
for item in sorted(items, key=lambda row: row['number']):
    number = item['number']
    (root / f'issue-{number}.json').write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n')
    paths = [f'issues/{number}/comments']
    if 'pull_request' in item:
        paths.extend([f'pulls/{number}', f'pulls/{number}/comments', f'pulls/{number}/reviews'])
    sections = [f"# {number}: {item['title']}\n\n{item['body']}\n"]
    for path in paths:
        data = subprocess.check_output(['gh', 'api', f'repos/link-foundation/universal-translator/{path}', '--paginate'], text=True)
        (root / (path.replace('/', '-') + '.json')).write_text(data)
        rows = json.loads(data)
        if isinstance(rows, dict):
            sections.append(f"## Pull request description\n\n{rows.get('body', '')}")
        else:
            for row in rows:
                sections.append(f"## {row.get('html_url')} by {row.get('user', {}).get('login')}\n\n{row.get('body', '')}")
    lines = ('\n\n'.join(sections) + '\n').splitlines(keepends=True)
    for start in range(0, len(lines), 1400):
        suffix = f'-part-{start // 1400 + 1}' if len(lines) > 1400 else ''
        (root / f'discussion-{number}{suffix}.md').write_text(''.join(lines[start:start + 1400]))
attachments = root / 'attachments'
attachments.mkdir(exist_ok=True)
issue = json.loads((root / 'issue.json').read_text())
for index, url in enumerate(re.findall(r'https://github.com/user-attachments/assets/[a-z0-9-]+', issue['body']), 1):
    target = attachments / f'issue-16-{index}.image'
    subprocess.run(['bash', '-c', 'curl -fsSL -H "Authorization: token $(gh auth token)" -o "$1" "$2"', 'download-attachment', str(target), url], check=True)
    subprocess.run(['file', str(target)], check=True)
