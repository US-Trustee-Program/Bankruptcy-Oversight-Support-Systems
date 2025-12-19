import { vi } from 'vitest';
import { QueryResults } from '../types/database';
import { handleQueryResult } from './gateway-helper';
import { CamsError } from '../../common-errors/cams-error';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';

const moduleName = 'gateway-helper-test';
describe('Gateway helper test', () => {
  const callback = vi.fn();

  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    callback.mockClear();
  });

  test('should execute callback if query result is successful', () => {
    const queryResult: QueryResults = {
      success: true,
      results: {
        recordset: [],
      },
      message: 'Some message',
    };

    handleQueryResult(context, queryResult, moduleName, callback);
    expect(callback).toHaveBeenCalled();
  });

  test('should throw CamsError if query result is not successful', async () => {
    const queryResult: QueryResults = {
      success: false,
      results: {
        recordset: [],
      },
      message: 'Some message',
    };

    expect(() => {
      handleQueryResult(context, queryResult, moduleName, callback);
    }).toThrow(new CamsError(moduleName, { message: queryResult.message }));
    expect(callback).not.toHaveBeenCalled();
  });
});
