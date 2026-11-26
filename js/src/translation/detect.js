// Language detection: the web demo and the command line can
// translate without being told the source language.
//
// Every language the translator reads is a candidate. A candidate whose
// grammar reads the whole text wins over one that reads only a part, and
// one that reads nothing comes last. Ties are broken by evidence from the
// language's own syntax tables (its function keyword, print call,
// comment marker and declaration keywords) and, for controlled natural
// languages, by how many words of the text are words of its templates.
// Only the best candidates by that evidence are read partially, so
// detection stays fast on long texts. Machine code (assembly, bytecode,
// intermediate languages) is read whole only: each dialect's reader takes
// its own programs and no other text.

import { grammarLanguageIds, languageSyntax } from '../formal/languages.js';
import { machineTargetIds } from '../formal/machine.js';
import { naturalLanguage, naturalLanguageIds } from '../natural/catalog.js';
import { tokenize } from '../natural/tokens.js';
import { isKnownWord, wordsOf } from '../natural/comments.js';

// Patterns that only one language (or a small family) writes.
const signatures = {
  javascript: [/\bconsole\.log\s*\(/u, /\b(?:let|const)\s+\w+\s*=/u, /===/u],
  typescript: [
    /\b(?:let|const)\s+\w+\s*:\s*\w+/u,
    /\):\s*(?:number|string|void)\b/u,
  ],
  python: [
    /^\s*(?:with|for|while|if)\b[^{]*:\s*$/mu,
    /^\s*def\s+\w+\(.*\)\s*:/mu,
    /^\s*(?:elif|pass)\b/mu,
    /\bprint\(/u,
  ],
  ruby: [/^\s*puts\b/mu, /^\s*def\s+\w+(?:\(.*\))?\s*$/mu, /\.each\b/u],
  lua: [/^\s*local\s+\w+/mu, /\bthen\s*$/mu, /~=/u],
  php: [/<\?php/u, /\$\w+\s*=/u, /\becho\b/u],
  c: [/#include\s*<stdio\.h>/u, /\bprintf\s*\(/u, /\bint\s+main\s*\(/u],
  cpp: [/#include\s*<iostream>/u, /std::cout/u, /\bstd::/u],
  csharp: [/\bConsole\.Write(?:Line)?\s*\(/u, /\busing\s+System\b/u],
  java: [
    /\bSystem\.out\.print(?:ln)?\s*\(/u,
    /\bpublic\s+static\s+void\s+main\b/u,
  ],
  go: [/\bfmt\.Print(?:ln|f)?\s*\(/u, /^\s*package\s+main\b/mu, /:=/u],
  rust: [/\bprintln!\s*\(/u, /\bfn\s+\w+\s*\(/u, /\blet\s+mut\b/u],
  kotlin: [/\bfun\s+\w+\s*\(/u, /\bprintln\s*\(/u, /\bval\s+\w+/u],
  swift: [/\bfunc\s+\w+\s*\(.*->/u, /\bvar\s+\w+\s*=/u, /\bprint\(/u],
  perl: [/\bmy\s+\$\w+/u, /^\s*use\s+strict\b/mu, /\bsub\s+\w+\s*\{/u],
  dart: [/\bvoid\s+main\s*\(\s*\)/u, /\bprint\(/u],
  scala: [/\bdef\s+\w+\(.*\)\s*:\s*\w+\s*=/u, /\bobject\s+\w+/u],
  julia: [/^\s*function\s+\w+\(.*\)\s*$/mu, /\bprintln\(/u, /^\s*end\s*$/mu],
  r: [/<-/u, /\bfunction\s*\(/u, /\bcat\s*\(/u],
  groovy: [/\bdef\s+\w+\s*=/u, /\bprintln\b/u],
  objc: [/#import\b/u, /\bNSLog\s*\(/u, /@"/u],
  nim: [/\bproc\s+\w+/u, /\becho\b/u],
  d: [/\bwriteln\s*\(/u, /^\s*import\s+std\./mu],
  pascal: [/^\s*program\s+\w+\s*;/imu, /\bwriteln\b/iu, /:=/u, /\bbegin\b/iu],
  fortran: [
    /^\s*program\s+\w+\s*$/imu,
    /\bimplicit\s+none\b/iu,
    /\bend\s+program\b/iu,
  ],
  ada: [/\bPut_Line\b/u, /^\s*with\s+Ada\./mu, /\bprocedure\b/u],
  vb: [
    /\bConsole\.WriteLine\b/u,
    /\bDim\s+\w+\s+As\b/u,
    /\bEnd\s+(?:Sub|Module|If)\b/u,
  ],
  bash: [/^#!\/bin\/(?:ba)?sh/u, /\becho\b/u, /\bfi\s*$/mu, /\$\(\(/u],
  matlab: [/\bdisp\s*\(/u, /\bfprintf\s*\(/u, /^\s*end\s*$/mu, /%/u],
  zig: [/@import\("std"\)/u, /\bstd\.debug\.print\b/u, /\bpub\s+fn\b/u],
  lean: [/\bdef\s+\w+.*:=/u, /\bIO\.println\b/u, /#eval\b/u],
  rocq: [/\bFixpoint\b/u, /\bDefinition\b/u, /\bCompute\b/u],
  nasm: [/^\s*section\s+\.text/mu, /^\s*global\s+_?main/mu, /\bmov\s+\w+,/u],
  cil: [/^\s*\.method\b/mu, /\bldc\.i4/u, /\.assembly\b/u],
  jvm: [/^\s*\.class\b/mu, /^\s*\.method\b/mu, /\binvokestatic\b/u],
  gas: [/^\s*\.globl\b/mu, /%r[sb]p\b/u, /^\s*(?:push|mov|sub)q\s/mu],
  arm64: [/^\s*stp\s+x\d+,/mu, /^\s*(?:ldr|str)\s+x\d+,/mu, /%function\b/u],
  llvm: [
    /^\s*define\s+\S+\s+@\w+\(/mu,
    /^\s*declare\s+\S+\s+@\w+\(/mu,
    /\balloca\b/u,
  ],
  wat: [/^\s*\(module\b/mu, /\blocal\.get\b/u, /\(func\s+\$\w+/u],
};

// Patterns a language never writes: Objective-C imports its headers, C and
// C++ include them, so "#import" rules C and C++ out.
const contradictions = {
  c: [/^\s*#import\b/mu],
  cpp: [/^\s*#import\b/mu],
};

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

function syntaxEvidence(source, id) {
  const syntax = languageSyntax(id);
  let score = 0;
  for (const pattern of signatures[id] ?? []) {
    if (pattern.test(source)) {
      score += 3;
    }
  }
  for (const pattern of contradictions[id] ?? []) {
    if (pattern.test(source)) {
      score -= 6;
    }
  }
  const words = [syntax.functionKeyword, ...(syntax.declarations ?? [])].filter(
    (word) => typeof word === 'string' && /^\w+$/u.test(word)
  );
  for (const word of words) {
    if (new RegExp(`\\b${escape(word)}\\b`, 'u').test(source)) {
      score += 1;
    }
  }
  const print = Object.values(syntax.print ?? {}).filter(
    (value) => typeof value === 'string' && value.length > 2
  );
  if (print.some((call) => source.includes(call))) {
    score += 2;
  }
  if (
    syntax.lineComment &&
    new RegExp(`^\\s*${escape(syntax.lineComment)}`, 'mu').test(source)
  ) {
    score += 1;
  }
  return score;
}

function wordEvidence(source, id) {
  const language = naturalLanguage(id);
  let tokens;
  try {
    tokens = tokenize(source, language).filter(
      (token) => token.type === 'word'
    );
  } catch {
    return 0;
  }
  if (!tokens.length) {
    return 0;
  }
  const known = tokens.filter(
    (token) =>
      language.reserved.has(token.folded) ||
      language.reverseLexicon.has(token.folded) ||
      isKnownWord(token.folded, id)
  ).length;
  return (10 * known) / tokens.length;
}

// Symbols that code writes and prose does not.
const codeSymbols = /[{}()[\];=<>+*/\\$#@&|^~`]/gu;

// How much of a text reads as prose of a natural language: its known words
// (in the vocabulary, the primes or the templates, directly or through
// their stems) among all its words and code symbols. Prose outside the
// controlled templates is still translated freely, so it counts as read.
function proseCoverage(source, id) {
  const words = wordsOf(source);
  if (!words.length) {
    return 0;
  }
  const language = naturalLanguage(id);
  const known = words.filter(
    (word) =>
      language.reserved.has(word) ||
      language.reverseLexicon.has(word) ||
      isKnownWord(word, id)
  ).length;
  const symbols = source.match(codeSymbols)?.length ?? 0;
  return known / (words.length + symbols);
}

// Every language a text may be written in, with the evidence for it.
const candidatesOf = (source) => [
  ...grammarLanguageIds.map((id) => ({
    id,
    natural: false,
    evidence: syntaxEvidence(source, id),
  })),
  ...machineTargetIds.map((id) => ({
    id,
    natural: false,
    machine: true,
    evidence: syntaxEvidence(source, id),
  })),
  ...naturalLanguageIds().map((id) => ({
    id,
    natural: true,
    // A profile only narrows its language, so on a tie the language itself
    // is the better guess.
    evidence: wordEvidence(source, id) - (naturalLanguage(id).base ? 0.5 : 0),
  })),
];

export function createLanguageDetector({ parseFragment, parsePartial }) {
  const reads = (source, id) => {
    try {
      parseFragment(source, id);
      return true;
    } catch {
      return false;
    }
  };

  // The likeliest languages first: { id, natural, score, reads, coverage }.
  return function detectLanguage(source, { limit = 5 } = {}) {
    if (!source.trim()) {
      return [];
    }
    const candidates = candidatesOf(source);
    for (const candidate of candidates) {
      candidate.reads = candidate.evidence > -1 && reads(source, candidate.id);
      candidate.coverage = candidate.reads ? 1 : 0;
    }
    // Read the best of the rest partially: the likeliest programming and
    // natural languages by evidence, so a text no grammar reads whole still
    // finds its language.
    const best = (natural) =>
      candidates
        .filter(
          (candidate) =>
            candidate.natural === natural &&
            !candidate.machine &&
            !candidate.reads
        )
        .sort((a, b) => b.evidence - a.evidence)
        .slice(0, limit);
    const unread = [...best(false), ...best(true)];
    for (const candidate of unread) {
      try {
        candidate.coverage = parsePartial(source, candidate.id).coverage;
      } catch {
        candidate.coverage = 0;
      }
    }
    for (const candidate of candidates) {
      if (candidate.natural && !candidate.reads) {
        candidate.coverage = Math.max(
          candidate.coverage,
          proseCoverage(source, candidate.id)
        );
      }
    }
    return candidates
      .map(({ id, natural, evidence, reads: whole, coverage }) => ({
        id,
        natural,
        reads: whole,
        coverage,
        score: Math.round((100 * coverage + evidence) * 100) / 100,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);
  };
}
