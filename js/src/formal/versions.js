// Versions of a programming language: the major versions and grammar
// variations it is written in. A version only changes how programs are
// written; reading accepts every version of the language, so one Python
// reads both `print "Hi"` and `print("Hi")`.
//
// A language id may name its version after "@": "python@2".

export const languageVersions = {
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
    .map(([version, { label }]) => ({
      version,
      label,
      default: version === described.default,
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
