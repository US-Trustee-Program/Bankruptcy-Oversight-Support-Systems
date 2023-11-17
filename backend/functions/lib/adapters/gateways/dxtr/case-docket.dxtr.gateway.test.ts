import { QueryResults } from '../../types/database';
import * as database from '../../utils/database';
import { DxtrCaseDocketGateway } from './case-docket.dxtr.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { DOCKET, NORMAL_CASE_ID } from './case-docket.mock.gateway';

describe('Test case docket DXTR Gateway', () => {
  const querySpy = jest.spyOn(database, 'executeQuery');

  describe('getCaseDocket', () => {
    test('should query the database with the correct predicate values for case id', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: DOCKET,
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });
      const gateway: DxtrCaseDocketGateway = new DxtrCaseDocketGateway();
      const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      await gateway.getCaseDocket(mockContext, NORMAL_CASE_ID);
      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        mockContext.config.dxtrDbConfig,
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ value: '11-11111' }),
          expect.objectContaining({ value: '111' }),
        ]),
      );
    });

    test('should return a docket consisting of an array of docket entries', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: DOCKET,
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });
      const gateway: DxtrCaseDocketGateway = new DxtrCaseDocketGateway();
      const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      const mockCaseId = NORMAL_CASE_ID;
      const response = await gateway.getCaseDocket(mockContext, mockCaseId);
      expect(response).toEqual(DOCKET);
    });

    test('should raise an exception when a case docket is not found', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });
      const gateway: DxtrCaseDocketGateway = new DxtrCaseDocketGateway();
      const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      const mockCaseId = '000-00-00000';
      await expect(gateway.getCaseDocket(mockContext, mockCaseId)).rejects.toThrow('Not found');
    });

    test('should raise an exception when a database error is encountred', async () => {
      const expectedMessage = 'some db error has occurred';
      const mockResults: QueryResults = {
        success: false,
        results: {
          recordset: [],
        },
        message: expectedMessage,
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });
      const gateway: DxtrCaseDocketGateway = new DxtrCaseDocketGateway();
      const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      const mockCaseId = '000-00-00000';
      await expect(gateway.getCaseDocket(mockContext, mockCaseId)).rejects.toThrow(expectedMessage);
    });
  });
});
