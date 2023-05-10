const semVerNumber = '0|[1-9]\\d*',
  semVerMeta = '[\\w\\.\\-]+',
  semVerSuffix = `(?<prerelease>\\-${semVerMeta})?(?<buildMeta>\\+${semVerMeta})?$`, // optional prerelease + build meta
  semVerMajor = new RegExp(`^(?<major>${semVerNumber})` + semVerSuffix),
  semVerMinor = new RegExp(`^(?<major>${semVerNumber})\\.(?<minor>${semVerNumber})` + semVerSuffix),
  semVer = new RegExp(
    `^(?<major>${semVerNumber})\\.(?<minor>${semVerNumber})\\.(?<patch>${semVerNumber})` + semVerSuffix
  ),
  semVerExt = new RegExp(
    `^(?<major>${semVerNumber})\\.(?<minor>${semVerNumber})\\.(?<patch>${semVerNumber})\\.(?<build>[^\-\+]+)` +
      semVerSuffix
  ),
  number = new RegExp(`^(?:${semVerNumber})$`),
  any = Symbol();

export const isValid = s => {
  switch (s && typeof s) {
    case 'object':
      return (
        ((typeof s.major == 'number' && !isNaN(s.major)) || s.major === any) &&
        ((typeof s.minor == 'number' && !isNaN(s.minor)) || s.minor === any) &&
        ((typeof s.patch == 'number' && !isNaN(s.patch)) || s.patch === any)
      );
    case 'string': {
      let parts = semVerExt.exec(s);
      if (!parts) parts = semVer.exec(s);
      if (!parts) parts = semVerMinor.exec(s);
      if (!parts) parts = semVerMajor.exec(s);
      return !!parts;
    }
  }
  return false;
};

export const parse = (s, defaultValue = 0) => {
  const version = {};

  let parts = semVerExt.exec(s);
  if (!parts) parts = semVer.exec(s);
  if (!parts) parts = semVerMinor.exec(s);
  if (!parts) parts = semVerMajor.exec(s);
  if (!parts) throw new Error('Wrong semantic version: ' + s);
  version.major = +parts.groups.major;
  version.minor = parts.groups.minor ? +parts.groups.minor : defaultValue;
  version.patch = parts.groups.patch ? +parts.groups.patch : defaultValue;
  version.build = parts.groups.build || defaultValue;

  const prerelease = parts.groups.prerelease;
  if (prerelease) {
    version.prerelease = prerelease
      .slice(1)
      .split('.')
      .map(part => (number.test(part) ? +part : part));
  }

  const buildMeta = parts.groups.buildMeta;
  if (buildMeta) {
    version.buildMeta = buildMeta
      .slice(1)
      .split('.')
      .map(part => (number.test(part) ? +part : part));
  }

  return version;
};

export const compare = (a, b, defaultValue = 0) => {
  if (typeof a == 'string') {
    a = parse(a, defaultValue);
  }
  if (typeof b == 'string') {
    b = parse(b, defaultValue);
  }

  // compare major
  if (a.major !== any && b.major !== any) {
    const result = a.major - b.major;
    if (result) return result;
  }

  // compare minor
  if (a.minor !== any && b.minor !== any) {
    const result = a.minor - b.minor;
    if (result) return result;
  }

  // compare patch
  if (a.patch !== any && b.patch !== any) {
    const result = a.patch - b.patch;
    if (result) return result;
  }

  // compare build
  if (a.build !== any && b.build !== any) {
    if (a.build < b.build) return -1;
    if (b.build < a.build) return 1;
  }

  // compare prerelease
  if (a.prerelease !== any && b.prerelease !== any && a.prerelease !== b.prerelease) {
    if (!Array.isArray(a.prerelease)) return 1;
    if (!Array.isArray(b.prerelease)) return -1;
    for (let i = 0, n = Math.min(a.prerelease.length, b.prerelease.length); i < n; ++i) {
      const x = a.prerelease[i],
        y = b.prerelease[i];
      if (typeof x == 'number') {
        if (typeof y == 'number') {
          if (x === y) continue;
          return x - y;
        }
        return -1;
      }
      if (typeof y == 'number') return 1;
      if (x === y) continue;
      if (x < y) return -1;
      return 1;
    }
    const prereleaseResult = a.prerelease.length - b.prerelease.length;
    if (prereleaseResult) return prereleaseResult;
  }

  // compare buildMeta
  if (a.buildMeta === any || b.buildMeta === any || a.buildMeta === b.buildMeta) return 0;
  if (!Array.isArray(a.buildMeta)) return 1;
  if (!Array.isArray(b.buildMeta)) return -1;
  for (let i = 0, n = Math.min(a.buildMeta.length, b.buildMeta.length); i < n; ++i) {
    const x = a.buildMeta[i],
      y = b.buildMeta[i];
    if (typeof x == 'number') {
      if (typeof y == 'number') {
        if (x === y) continue;
        return x - y;
      }
      return 1;
    }
    if (typeof y == 'number') return 1;
    if (x === y) continue;
    if (x < y) return -1;
    return 1;
  }
  return a.buildMeta.length - b.buildMeta.length;
};

export const getRange = targetString => targetString.split('-').map(ver => parse(ver, any));

export const match = (version, range) => {
  const [a, b] = typeof range == 'string' ? getRange(range) : range;
  a.prerelease = a.buildMeta = any;
  if (!b) return !compare(version, a);
  b.prerelease = b.buildMeta = any;
  return compare(a, version) <= 0 && compare(version, b) <= 0;
};
