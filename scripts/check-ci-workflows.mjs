#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Verified against the action tag's support/versions table, without network in CI:
// https://github.com/zizmorcore/zizmor-action/blob/v0.6.4/support/versions
const supportedZizmor = { 'v0.6.4': '1.30.1' };

// First major of each action whose action.yml declares `using: node24`;
// every earlier major declares node20, checked at each tag. GitHub runs those
// on Node 24 with a "Node.js 20 is deprecated" warning on every job.
const firstNode24Major = {
  'actions/cache': 5,
  'actions/cache/restore': 5,
  'actions/cache/save': 5,
  'actions/checkout': 5,
  'actions/setup-node': 5,
  'actions/upload-artifact': 6,
  'actions/download-artifact': 7,
  'actions/setup-java': 5,
  'actions/setup-python': 6,
  'actions/configure-pages': 6,
  'actions/deploy-pages': 5,
  'actions/github-script': 8,
  'docker/login-action': 4,
  'github/codeql-action/init': 4,
  'github/codeql-action/analyze': 4,
  'github/codeql-action/autobuild': 4,
};

function deprecatedRuntime(action, ref) {
  const fixed = firstNode24Major[action];
  const major = Number(ref.match(/^v(\d+)/)?.[1]);
  return fixed && major < fixed ? `v${fixed}` : undefined;
}

export function checkWorkflowPolicy(text) {
  const errors = [];
  const shellText = text.replace(/\\\r?\n\s*/g, ' ');
  for (const line of shellText.split('\n')) {
    const code = line.replace(/\s*#.*$/, '');
    if (/\b(?:ubuntu|windows|macos)-latest\b/.test(code)) {
      errors.push('Pin hosted runners to an explicit image');
    }
    const uses = code.match(/\buses:\s*([\w.-]+\/[\w./-]+)@(v\d[\w.]*)/);
    if (uses) {
      const fixed = deprecatedRuntime(uses[1], uses[2]);
      if (fixed) {
        errors.push(
          `${uses[1]}@${uses[2]} runs on deprecated Node.js 20; use ${fixed} or later`
        );
      }
    }
    if (/\bnpx\b/.test(code)) {
      for (const match of code.matchAll(
        /(?:\s)(?:-p|--package)(?:\s+|=)(\S+)/g
      )) {
        const spec = match[1].replace(/^['"]|['"]$/g, '');
        if (!/^(?:@[^/\s]+\/)?[^@\s]+@\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(spec)) {
          errors.push(`Pin npx package to an exact version: ${spec}`);
        }
      }
    }
  }
  const action = text.match(/zizmorcore\/zizmor-action@(\S+)/)?.[1];
  if (action) {
    const version = text
      .slice(text.indexOf('zizmorcore/zizmor-action@'))
      .match(/\bversion:\s*(\d+\.\d+\.\d+)/)?.[1];
    const cliVersions = Array.from(
      text.matchAll(/zizmor==(\d+\.\d+\.\d+)/g),
      (match) => match[1]
    );
    if (!version || cliVersions.some((cliVersion) => cliVersion !== version)) {
      errors.push(
        'Every zizmor pass and reproduction command must use the action version'
      );
    }
    if (supportedZizmor[action] !== version) {
      errors.push(`Verify zizmor ${version} is supported by action ${action}`);
    }
  }
  return errors;
}

function workflowFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? workflowFiles(path)
      : /\.ya?ml$/.test(path)
        ? [path]
        : [];
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const files = [
    ...workflowFiles('.github/workflows'),
    ...workflowFiles('.github/actions'),
  ];
  for (const path of files) {
    for (const error of checkWorkflowPolicy(readFileSync(path, 'utf8'))) {
      console.error(`::error file=${path}::${error}`);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) {
    console.log(
      'Workflow package, zizmor, action runtime, and hosted runner pins verified'
    );
  }
}
