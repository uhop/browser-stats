// the canonical set operations

// in place operations

export const intersectionInPlace = (a, b) => {
  for (const item of a.keys()) {
    if (!b.has(item)) a.delete(item);
  }
  return a;
};

export const unionInPlace = (a, b) => {
  for (const item of b.keys()) {
    a.add(item);
  }
  return a;
};

export const differenceInPlace = (a, b) => {
  for (const item of b.keys()) {
    a.delete(item);
  }
  return a;
};

export const symmetricDifferenceInPlace = (a, b) => {
  for (const item of b.keys()) {
    if (a.has(item)) {
      a.delete(item);
    } else {
      a.add(item);
    }
  }
  return a;
};

// non-mutating operations

export const intersection = (a, b) => {
  if (b.size < a.size) [a, b] = [b, a]; // swap
  const result = new Set();
  for (const item of a.keys()) {
    if (b.has(item)) result.add(item);
  }
  return result;
};

export const union = (a, b) => {
  if (b.size < a.size) [a, b] = [b, a]; // swap
  return unionInPlace(new Set(b), a);
};

export const difference = (a, b) => differenceInPlace(new Set(a), b);

export const symmetricDifference = (a, b) => {
  if (b.size < a.size) [a, b] = [b, a]; // swap
  return symmetricDifferenceInPlace(new Set(b), a);
};

// boolean operations

export const isDisjointFrom = (a, b) => {
  if (b.size < a.size) [a, b] = [b, a]; // swap
  for (const item of a.keys()) {
    if (b.has(item)) return false;
  }
  return true;
};

export const isSubsetOf = (a, b) => {
  if (b.size < a.size) return false;
  for (const item of a.keys()) {
    if (!b.has(item)) return false;
  }
  return true;
};

export const isSupersetOf = (a, b) => isSubsetOf(b, a);
