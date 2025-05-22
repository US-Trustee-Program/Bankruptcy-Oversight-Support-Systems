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
 * @param dirty
 * @param mask
 */
export function maskToExtendedAscii(dirty: string, mask: string): string {
  // TODO: Should we just limit this to the ASCII printable characters (32-126)?
  // TODO: Is there value to keeping Extended ASCII characters (128-255) in the string?
  // TODO: Unicode variation selectors cause >1 one-byte character replacements. Coalesce to a single replacement?
  return Array.from(dirty)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code <= 255 ? char : mask;
    })
    .join('');
}

export function filterToExtendedAscii(dirty: string): string {
  return maskToExtendedAscii(dirty, '');
}
