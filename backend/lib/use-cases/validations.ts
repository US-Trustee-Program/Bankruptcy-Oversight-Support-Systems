import { sanitizeDeepCore } from '@common/cams/sanitization';
import { LoggerImpl } from '../adapters/services/logger.service';
import { BadRequestError } from '../common-errors/bad-request';

const MODULE_NAME = 'VALIDATIONS';

export function sanitizeDeep<T>(
  input: T,
  moduleName: string,
  logger: LoggerImpl,
  scrubUnicode: boolean = true,
): T {
  const parsedMaxObjectDepth = parseInt(process.env.MAX_OBJECT_DEPTH);
  const maxObjectDepth = isNaN(parsedMaxObjectDepth) ? 50 : parsedMaxObjectDepth;
  const parsedMaxObjectKeyCount = parseInt(process.env.MAX_OBJECT_KEY_COUNT);
  const maxObjectKeyCount = isNaN(parsedMaxObjectKeyCount) ? 1000 : parsedMaxObjectKeyCount;

  const result = sanitizeDeepCore(input, {
    scrubUnicode,
    maxObjectDepth,
    maxObjectKeyCount,
    onInvalidInput: () => {
      throw new BadRequestError(moduleName, { message: 'Invalid user input.' });
    },
    onDepthExceeded: () => {
      throw new Error('Max depth exceeded');
    },
    onKeyCountExceeded: () => {
      throw new Error('Max key count exceeded');
    },
  });

  logger.info(
    MODULE_NAME,
    `Total Depth: ${result.metadata.totalDepth}, Total Key Count: ${result.metadata.totalKeyCount}`,
  );

  return result.value;
}
