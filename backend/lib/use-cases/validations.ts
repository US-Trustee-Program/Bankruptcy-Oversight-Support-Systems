import { filterToExtendedAscii, isValidUserInput } from '@common/cams/sanitization';
import { LoggerImpl } from '../adapters/services/logger.service';
import { BadRequestError } from '../common-errors/bad-request';

const MODULE_NAME = 'VALIDATIONS';

export function sanitizeDeep<T>(
  input: T,
  moduleName: string,
  logger: LoggerImpl,
  scrubUnicode: boolean = true,
): T {
  const seen = new WeakMap();
  const parsedMaxObjectDepth = parseInt(process.env.MAX_OBJECT_DEPTH);
  const MAX_OBJECT_DEPTH = isNaN(parsedMaxObjectDepth) ? 50 : parsedMaxObjectDepth;
  const parsedMaxObjectKeyCount = parseInt(process.env.MAX_OBJECT_KEY_COUNT);
  const MAX_OBJECT_KEY_COUNT = isNaN(parsedMaxObjectKeyCount) ? 1000 : parsedMaxObjectKeyCount;
  let totalDepth = 0;
  let totalKeyCount = 0;

  const _sanitize = (input: unknown, depth: number, scrubUnicode: boolean): unknown => {
    totalDepth = depth;
    if (depth > MAX_OBJECT_DEPTH) {
      throw new Error('Max depth exceeded');
    }

    if (typeof input === 'string') {
      if (!isValidUserInput(input)) {
        throw new BadRequestError(moduleName, { message: 'Invalid user input.' });
      }
      if (scrubUnicode) {
        return filterToExtendedAscii(input) as unknown as T;
      }
    }
    if (Array.isArray(input)) {
      return input.map((item) => _sanitize(item, depth + 1, scrubUnicode)) as unknown as T;
    }
    if (input && typeof input === 'object') {
      const keyCount = Object.keys(input).length;
      totalKeyCount += keyCount;
      if (keyCount > MAX_OBJECT_KEY_COUNT) {
        throw new Error('Max key count exceeded');
      }

      if (seen.has(input)) {
        return seen.get(input);
      }

      const result: Record<string, unknown> = {};
      // This sets the value of the object in the map to the reference of `result`.
      seen.set(input, result);
      for (const [key, value] of Object.entries(input)) {
        result[key] = _sanitize(value, depth + 1, scrubUnicode);
      }
      return result as T;
    }
    return input;
  };

  const sanitizedContent = _sanitize(input, 0, scrubUnicode) as T;

  logger.info(MODULE_NAME, `Total Depth: ${totalDepth}, Total Key Count: ${totalKeyCount}`);
  return sanitizedContent;
}
