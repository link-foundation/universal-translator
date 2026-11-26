// Versions of a programming language: the major versions and grammar
// variations it is written in. A version only changes how programs are
// written; reading accepts every version of the language, so one Python
// reads both `print "Hi"` and `print("Hi")`.
//
// A language id may name its version after "@": "python@2".

export const languageVersions = {
  javascript: {
    default: 'es6',
    versions: {
      es6: {
        label: 'ECMAScript 2015 and later (let, const, template strings)',
      },
      es5: {
        label: 'ECMAScript 5',
        // ES5 has no let, const, template strings, Math.trunc,
        // Array.prototype.fill or for...of: variables are `var`, text is
        // joined with +, integers are truncated with `~~`, a filled array is
        // created and then filled by a loop, and a for-each loop counts over
        // the indexes of its array.
        syntax: {
          forEach: undefined,
          declarationKeyword: 'var',
          textJoin: 'concatenation',
          integerDivision: { wrapper: '~~' },
          arrayFill: 'always',
        },
      },
    },
  },
  php: {
    default: '7',
    versions: {
      7: { label: 'PHP 7 and later (short arrays, intdiv)' },
      5: {
        label: 'PHP 5',
        // PHP 5 has no intdiv() and writes arrays as array(...) (the [...]
        // spelling came with PHP 5.4).
        syntax: {
          integerDivision: { call: undefined, wrapper: '(int) ' },
        },
      },
    },
  },
  csharp: {
    default: '6',
    versions: {
      6: { label: 'C# 6 and later (string interpolation)' },
      5: {
        label: 'C# 5',
        // C# 5 has no $"..." strings: computed parts are converted with
        // Convert.ToString and joined with +.
        syntax: {
          textJoin: 'concatenation',
          textConversions: ['System.Convert.ToString'],
        },
      },
    },
  },
  python: {
    default: '3',
    versions: {
      3: { label: 'Python 3 (3.6+, f-strings)' },
      2: {
        label: 'Python 2.7',
        // Python 2 has no f-strings: computed parts are converted with str()
        // and concatenated; print is a statement.
        syntax: { textJoin: 'concatenation', printStatement: true },
      },
    },
  },
};

// "python@2" -> { id: 'python', version: '2' }.
export function splitVersion(identifier) {
  const at = identifier.indexOf('@');
  return at < 0
    ? { id: identifier, version: undefined }
    : { id: identifier.slice(0, at), version: identifier.slice(at + 1) };
}

// The versions of a language, the default first, for menus.
export function versionsOf(id) {
  const described = languageVersions[id];
  if (!described) {
    return [];
  }
  return Object.entries(described.versions)
    .map(([version, { label, custom }]) => ({
      version,
      label,
      default: version === described.default,
      ...(custom ? { custom: true } : {}),
    }))
    .sort((left, right) => Number(right.default) - Number(left.default));
}

// The syntax changes of one version (none for the default version).
export function versionSyntax(id, version) {
  if (version === undefined) {
    return {};
  }
  const described = languageVersions[id]?.versions[version];
  if (!described) {
    throw new Error(`${id} has no version "${version}"`);
  }
  return { ...described.syntax, version };
}

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A syntax with the changes of a version: nested tables (operators, words,
// print, ...) are merged key by key, every other value is replaced.
export function mergeSyntax(syntax, changes) {
  const merged = { ...syntax };
  for (const [key, value] of Object.entries(changes)) {
    merged[key] =
      isRecord(value) && isRecord(syntax[key])
        ? mergeSyntax(syntax[key], value)
        : value;
  }
  return merged;
}

const versionName = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;

// Add a version of a language of one's own: a standard that starts from the
// closest language and changes some of its words, for example a Python whose
// "and" is spelled "&&". The version is then written as "python@<version>".
export function registerLanguageVersion(id, version, { label, syntax = {} }) {
  if (!versionName.test(version)) {
    throw new Error(`"${version}" is not a version name`);
  }
  languageVersions[id] ??= { default: undefined, versions: {} };
  const { versions } = languageVersions[id];
  if (versions[version] && !versions[version].custom) {
    throw new Error(`${id}@${version} is a built-in version`);
  }
  versions[version] = {
    label: label ?? `${id} ${version}`,
    syntax,
    custom: true,
  };
  return `${id}@${version}`;
}

// Remove a version added with registerLanguageVersion.
export function unregisterLanguageVersion(id, version) {
  const described = languageVersions[id]?.versions[version];
  if (!described?.custom) {
    throw new Error(`${id}@${version} is not a version of one's own`);
  }
  delete languageVersions[id].versions[version];
}
