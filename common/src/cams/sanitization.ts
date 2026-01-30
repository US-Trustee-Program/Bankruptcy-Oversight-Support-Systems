const MONGO_CONSOLE_INJECTED_PATTERN = RegExp(
  /\b(?:db\.[a-zA-Z]+|mongo\.[a-zA-Z]+|(?:find|insert|update|delete|aggregate|create|drop|remove|replace|count|distinct|mapReduce|save)\b\s*:\{})/i,
);
const JAVASCRIPT_INJECTED_PATTERN = RegExp(
  /<script\b[^>]*>[\s\S]*?<\/script>|fetch\s*\(.*?\)|eval\s*\(.*?\)|window\.[a-zA-Z_$][a-zA-Z0-9_$]*|document\.[a-zA-Z_$][a-zA-Z0-9_$]*/gi,
);
const MONGO_QUERY_INJECTED_PATTERN = RegExp(
  /\$(eq|ne|gt|gte|lt|lte|in|nin|and|or|not|regex|exists|type|mod|text|where|all|elemMatch|size)/,
);

export function isValidUserInput(input: string) {
  return !(
    input.match(MONGO_CONSOLE_INJECTED_PATTERN) ||
    input.match(JAVASCRIPT_INJECTED_PATTERN) ||
    input.match(MONGO_QUERY_INJECTED_PATTERN)
  );
}

/**
 * Replaces all UTF-8 characters outside the Extended ASCII range (0-255) with the provided replacement.
 * Replaces all non-printable ASCII characters (0-31) with the provided replacement.
 *
 * @param dirty
 * @param mask
 */
export function maskToExtendedAscii(dirty: string, mask: string): string {
  return (
    dirty
      // 1. Remove emojis (covers most emoji ranges in Unicode)
      .replace(
        /([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E6}-\u{1F1FF}])/gu,
        mask,
      )
      // 2. Remove variation selectors (FE00–FE0F, etc.)
      .replace(/[\uFE00-\uFE0F\u180B-\u180D\uFE20-\uFE2F]/gu, mask)
      // 3. Replace characters not in allowed set:
      //    - Printable ASCII: \x20-\x7E
      //    - Accented Latin-1 letters: \xC0-\xFF, excluding non-letters later
      .replace(/[^\x20-\x7E\xC0-\xD6\xD8-\xF6\xF8-\xFF]/g, mask)
      // 4. Replace non-printable ASCII (0–31)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F]/g, mask)
  );
}

/**
 * Filters all UTF-8 characters outside the Extended ASCII range (0-255).
 * Filters all non-printable ASCII characters (0-31).
 *
 * @param dirty
 */
export function filterToExtendedAscii(dirty: string): string {
  return maskToExtendedAscii(dirty, '');
}

export function sanitizeUrl(dirty: string): string {
  // Regex pattern for valid URLs with http, https, and mailto protocols
  const validUrlPattern =
    /^(https?:\/\/(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?::\d{1,5})?(?:\/[^\s]*)?|mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

  // Additional checks for common malformed patterns
  if (
    !dirty ||
    dirty.includes(' ') ||
    dirty.includes('..') ||
    (dirty.startsWith('http://') && dirty.length <= 7) ||
    (dirty.startsWith('https://') && dirty.length <= 8) ||
    (dirty.startsWith('mailto:') && dirty.length <= 7) ||
    dirty.endsWith('.')
  ) {
    return '';
  }

  return validUrlPattern.test(dirty) ? dirty : '';
}

export interface SanitizeDeepOptions {
  scrubUnicode?: boolean;
  maxObjectDepth?: number;
  maxObjectKeyCount?: number;
  onInvalidInput?: (input: string) => string | never;
  onDepthExceeded?: (depth: number, max: number) => void | never;
  onKeyCountExceeded?: (count: number, max: number) => void | never;
}

export interface SanitizeDeepResult<T> {
  value: T;
  metadata: {
    totalDepth: number;
    totalKeyCount: number;
    strippedCount: number;
  };
}

export class SanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizationError';
  }
}

export function sanitizeDeepCore<T>(
  input: T,
  options: SanitizeDeepOptions = {},
): SanitizeDeepResult<T> {
  const seen = new WeakMap();
  const scrubUnicode = options.scrubUnicode ?? true;
  const maxObjectDepth = options.maxObjectDepth ?? 50;
  const maxObjectKeyCount = options.maxObjectKeyCount ?? 1000;
  let totalDepth = 0;
  let totalKeyCount = 0;
  let strippedCount = 0;

  const _sanitize = (input: unknown, depth: number, scrubUnicode: boolean): unknown => {
    totalDepth = depth;
    if (depth > maxObjectDepth) {
      options.onDepthExceeded?.(depth, maxObjectDepth);
      return input;
    }

    if (typeof input === 'string') {
      if (!isValidUserInput(input)) {
        strippedCount++;
        const result = options.onInvalidInput?.(input);
        return result !== undefined ? result : input;
      }
      if (scrubUnicode) {
        return filterToExtendedAscii(input);
      }
    }
    if (Array.isArray(input)) {
      return input.map((item) => _sanitize(item, depth + 1, scrubUnicode)) as unknown as T;
    }
    if (input && typeof input === 'object') {
      if (input instanceof Date) {
        return input;
      }

      const keyCount = Object.keys(input).length;
      totalKeyCount += keyCount;
      if (keyCount > maxObjectKeyCount) {
        options.onKeyCountExceeded?.(keyCount, maxObjectKeyCount);
      }

      if (seen.has(input)) {
        return seen.get(input);
      }

      const result: Record<string, unknown> = {};
      seen.set(input, result);
      for (const [key, value] of Object.entries(input)) {
        result[key] = _sanitize(value, depth + 1, scrubUnicode);
      }
      return result as T;
    }
    return input;
  };

  const sanitizedContent = _sanitize(input, 0, scrubUnicode) as T;

  return {
    value: sanitizedContent,
    metadata: {
      totalDepth,
      totalKeyCount,
      strippedCount,
    },
  };
}

/**
 * Sanitizes user input deeply by recursively validating strings against injection patterns.
 *
 * IMPORTANT: Regex Pattern False Positives
 * The validation patterns in isValidUserInput() are intentionally broad to prevent
 * injection attacks, but may flag legitimate user input in edge cases.
 *
 * Examples of potential false positives:
 * - "document.f" (ends sentence with "document.") matches JAVASCRIPT_INJECTED_PATTERN
 * - "find: the answer" may match MONGO_CONSOLE_INJECTED_PATTERN if formatted certain ways
 * - Technical discussions about MongoDB or JavaScript may trigger patterns
 *
 * FUTURE REFINEMENT: Consider adding more context requirements (word boundaries,
 * require opening parentheses for function calls) to reduce false positives while
 * maintaining security. Track user complaints via Application Insights logging.
 *
 * Current patterns in isValidUserInput():
 * - MONGO_CONSOLE_INJECTED_PATTERN: db.*, mongo.*, find, insert, update, delete, etc.
 * - JAVASCRIPT_INJECTED_PATTERN: script tags, fetch(), eval(), window.*, document.*
 * - MONGO_QUERY_INJECTED_PATTERN: $eq, $ne, $gt, $where, $and, $or, etc.
 */
export function sanitizeDeep<T>(
  input: T,
  scrubUnicode: boolean = true,
  onStripped?: (invalidString: string) => void,
): T {
  const result = sanitizeDeepCore(input, {
    scrubUnicode,
    maxObjectDepth: 50,
    maxObjectKeyCount: 1000,
    onInvalidInput: (invalidString) => {
      onStripped?.(invalidString);
      return '';
    },
    onDepthExceeded: (depth, max) => {
      throw new SanitizationError(`Max depth exceeded: ${depth} > ${max}`);
    },
    onKeyCountExceeded: (count, max) => {
      throw new SanitizationError(`Max key count exceeded: ${count} > ${max}`);
    },
  });

  return result.value;
}
