import { filterToExtendedAscii, isValidUserInput } from '../../../common/src/cams/sanitization';
import { BadRequestError } from '../common-errors/bad-request';

export function sanitizeDeep<T>(input: T, moduleName: string): T {
  const seen = new WeakSet();
  const MAX_OBJECT_DEPTH = parseInt(process.env.MAX_OBJECT_DEPTH) ?? 50;
  const MAX_OBJECT_KEY_COUNT = parseInt(process.env.MAX_OBJECT_KEY_COUNT) ?? 1000;

  function _sanitize(input: unknown, depth: number): unknown {
    if (depth > MAX_OBJECT_DEPTH) {
      throw new Error('Max depth exceeded');
    }

    if (typeof input === 'string') {
      if (!isValidUserInput(input)) {
        throw new BadRequestError(moduleName, { message: 'Invalid user input.' });
      }
      return filterToExtendedAscii(input) as unknown as T;
    }
    if (Array.isArray(input)) {
      return input.map((item) => _sanitize(item, depth + 1)) as unknown as T;
    }
    if (input && typeof input === 'object') {
      if (Object.keys(input).length > MAX_OBJECT_KEY_COUNT) {
        throw new Error('Max key count exceeded');
      }

      if (seen.has(input)) {
        return null;
      }

      seen.add(input);
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        result[key] = _sanitize(value, depth + 1);
      }
      return result as T;
    }
    return input;
  }

  return _sanitize(input, 0) as T;
}
