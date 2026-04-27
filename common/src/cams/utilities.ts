function keyValuesToArray(kvString: string): string[][] {
  const array: string[][] = [];
  if (!kvString) return array;
  const pairs = kvString.split('|');
  pairs.forEach((pair) => {
    const delimiterPosition = pair.indexOf('=');
    if (delimiterPosition > 0) {
      const key = pair.slice(0, delimiterPosition).trim();
      const value = pair.slice(delimiterPosition + 1).trim();
      array.push([key, value]);
    }
  });
  return array;
}

export function keyValuesToRecord(kvString: string): Record<string, string> {
  const obj: Record<string, string> = {};
  keyValuesToArray(kvString).forEach((element) => {
    obj[element[0]] = element[1];
  });
  return obj;
}

export function keyValuesToMap(kvString: string): Map<string, string> {
  const map = new Map<string, string>();
  keyValuesToArray(kvString).forEach((element) => {
    map.set(element[0], element[1]);
  });
  return map;
}

export function symmetricDifference(set1: Set<string>, set2: Set<string>) {
  const result = new Set();

  for (const element of set1) {
    if (!set2.has(element)) {
      result.add(element);
    }
  }

  for (const element of set2) {
    if (!set1.has(element)) {
      result.add(element);
    }
  }

  return result;
}
