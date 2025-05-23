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
