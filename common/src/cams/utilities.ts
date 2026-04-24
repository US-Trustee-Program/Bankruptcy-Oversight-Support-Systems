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

/**
 * Calculates the Levenshtein distance between two strings.
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to transform one string into another.
 *
 * @param str1 - The first string
 * @param str2 - The second string
 * @returns The Levenshtein distance between the two strings
 *
 * @example
 * levenshteinDistance('kitten', 'sitting') // returns 3
 * levenshteinDistance('book', 'back') // returns 2
 * levenshteinDistance('hello', 'hello') // returns 0
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize first column (deletions from str1)
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  // Initialize first row (insertions to str1)
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculates the similarity percentage between two strings using Levenshtein distance.
 * The similarity is calculated as: ((maxLength - distance) / maxLength) * 100
 *
 * @param str1 - The first string
 * @param str2 - The second string
 * @param caseSensitive - Whether to perform case-sensitive comparison (default: false)
 * @returns A number between 0 and 100 representing the similarity percentage
 *
 * @example
 * calculateStringSimilarity('John Doe', 'John Doe') // returns 100
 * calculateStringSimilarity('John Doe', 'Jon Doe') // returns ~88.9
 * calculateStringSimilarity('hello', 'HELLO') // returns 100 (case-insensitive by default)
 * calculateStringSimilarity('hello', 'HELLO', true) // returns 0 (case-sensitive)
 */
export function calculateStringSimilarity(
  str1: string,
  str2: string,
  caseSensitive: boolean = false,
): number {
  const normalized1 = caseSensitive ? str1.trim() : str1.toLowerCase().trim();
  const normalized2 = caseSensitive ? str2.trim() : str2.toLowerCase().trim();

  if (normalized1 === normalized2) return 100;

  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(normalized1, normalized2);
  return ((maxLength - distance) / maxLength) * 100;
}
