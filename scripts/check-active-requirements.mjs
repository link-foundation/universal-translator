#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';

const active = 'REQUIREMENTS.md';
const archive = 'requirements-archive/';
const docs = new URL('../docs/', import.meta.url);
const requirement = /^## (UT-\d+(?:\.\d+)+) \S/u;
const checklistItem = /^- \[([ xX])\] \S/u;
const ids = new Set();

function readRequirements(file) {
  const source = readFileSync(new URL(file, docs), 'utf8');
  const lines = source.split(/\r?\n/u);
  if (lines.at(-1) === '') {
    lines.pop();
  }
  if (lines.length > 1500) {
    throw new Error(`docs/${file} has ${lines.length} lines (maximum 1500)`);
  }
  const groups = [];
  for (const [index, line] of lines.entries()) {
    if (line.startsWith('## ')) {
      const [, id] = requirement.exec(line) ?? [];
      if (!id || ids.has(id)) {
        throw new Error(
          `docs/${file}:${index + 1} has an invalid or duplicate ID`
        );
      }
      ids.add(id);
      groups.push({ id, tasks: 0, open: 0 });
    }
    if (line.startsWith('- [')) {
      const [, state] = checklistItem.exec(line) ?? [];
      const group = groups.at(-1);
      if (!group || !state) {
        throw new Error(
          `docs/${file}:${index + 1} has an invalid checklist item`
        );
      }
      group.tasks++;
      group.open += Number(state === ' ');
    }
  }
  if (groups.some(({ tasks }) => tasks === 0)) {
    throw new Error(`Each requirement in docs/${file} needs a checklist`);
  }
  return groups;
}

const groups = readRequirements(active);
const completed = groups.filter(({ open }) => open === 0);
if (completed.length) {
  const list = completed.map(({ id }) => id).join(', ');
  throw new Error(`Move completed requirements to docs/${archive} (${list})`);
}
const files = readdirSync(new URL(archive, docs)).filter((file) =>
  file.endsWith('.md')
);
for (const file of files) {
  const archived = readRequirements(`${archive}${file}`);
  if (
    archived.length !== 1 ||
    `${archived[0].id}.md` !== file ||
    archived[0].open
  ) {
    throw new Error(
      `docs/${archive}${file} must contain its named, completed requirement`
    );
  }
}
console.log(
  `${groups.length} open requirement groups; ${files.length} archived`
);
