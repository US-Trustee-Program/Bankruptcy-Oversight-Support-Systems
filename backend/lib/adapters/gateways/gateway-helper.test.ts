import { vi } from 'vitest';
import * as fs from 'fs';
import { QueryResults } from '../types/database';
import { GatewayHelper, handleQueryResult } from './gateway-helper';
import { CamsError } from '../../common-errors/cams-error';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';

vi.mock('fs');

const moduleName = 'gateway-helper-test';

describe('GatewayHelper', () => {
  let helper: GatewayHelper;

  beforeEach(() => {
    helper = new GatewayHelper();
    vi.resetAllMocks();
  });

  test('getAllCasesMockExtract returns parsed JSON when file read succeeds', () => {
    const mockCases = [{ caseId: '001' }];
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCases));
    const result = helper.getAllCasesMockExtract();
    expect(result).toEqual(mockCases);
  });

  test('getAllCasesMockExtract throws when file read fails', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('file not found');
    });
    expect(() => helper.getAllCasesMockExtract()).toThrow('file not found');
  });

  test('getCaseDocketEntriesMockExtract returns docket entries', () => {
    const result = helper.getCaseDocketEntriesMockExtract();
    expect(result).toBeDefined();
  });

  test('getCaseHistoryMockExtract returns case history', () => {
    const result = helper.getCaseHistoryMockExtract();
    expect(result).toBeDefined();
  });

  test('getAllDebtorsMockExtract returns debtors map', () => {
    const result = helper.getAllDebtorsMockExtract();
    expect(result).toBeInstanceOf(Map);
  });

  test('getAllDebtorAttorneysMockExtract returns debtor attorneys map', () => {
    const result = helper.getAllDebtorAttorneysMockExtract();
    expect(result).toBeInstanceOf(Map);
  });
});

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
