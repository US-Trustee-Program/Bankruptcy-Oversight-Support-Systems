import { CamsError } from '../../common-errors/cams-error';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { QueryResults } from '../types/database';
import { handleQueryResult } from './gateway-helper';

const moduleName = 'gateway-helper-test';
describe('Gateway helper test', () => {
  const callback = jest.fn();

  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    callback.mockClear();
  });

  test('should execute callback if query result is successful', () => {
    const queryResult: QueryResults = {
      message: 'Some message',
      results: {
        recordset: [],
      },
      success: true,
    };

    handleQueryResult(context, queryResult, moduleName, callback);
    expect(callback).toHaveBeenCalled();
  });

  test('should throw CamsError if query result is not successful', async () => {
    const queryResult: QueryResults = {
      message: 'Some message',
      results: {
        recordset: [],
      },
      success: false,
    };

    expect(() => {
      handleQueryResult(context, queryResult, moduleName, callback);
    }).toThrow(new CamsError(moduleName, { message: queryResult.message }));
    expect(callback).not.toHaveBeenCalled();
  });
});
