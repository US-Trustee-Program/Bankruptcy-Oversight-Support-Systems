import { QueryResults } from '../../types/database';
import * as database from '../../utils/database';
import { documentSorter, DxtrCaseDocketGateway, translateModel } from './case-docket.dxtr.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { NORMAL_CASE_ID } from './case-docket.mock.gateway';
import {
  CASE_DOCKET_ENTRIES,
  DXTR_CASE_DOCKET_ENTRIES,
  DXTR_DOCKET_ENTRIES_DOCUMENTS,
} from '../../../testing/mock-data/case-docket-entries.mock';

describe('Test case docket DXTR Gateway', () => {
  const querySpy = jest.spyOn(database, 'executeQuery');

  describe('getCaseDocket', () => {
    test('should query the database with the correct predicate values for case id', async () => {
      const mockDocumentResults: QueryResults = {
        success: true,
        results: {
          recordset: DXTR_DOCKET_ENTRIES_DOCUMENTS,
        },
        message: '',
      };
      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockDocumentResults);
      });

      const mockEntryResults: QueryResults = {
        success: true,
        results: {
          recordset: DXTR_CASE_DOCKET_ENTRIES,
        },
        message: '',
      };
      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockEntryResults);
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
      const expected = CASE_DOCKET_ENTRIES;
      const mockDocumentResults: QueryResults = {
        success: true,
        results: {
          recordset: DXTR_DOCKET_ENTRIES_DOCUMENTS,
        },
        message: '',
      };
      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockDocumentResults);
      });

      const mockEntryResults: QueryResults = {
        success: true,
        results: {
          recordset: DXTR_CASE_DOCKET_ENTRIES,
        },
        message: '',
      };
      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockEntryResults);
      });
      const gateway: DxtrCaseDocketGateway = new DxtrCaseDocketGateway();
      const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      const mockCaseId = NORMAL_CASE_ID;
      const response = await gateway.getCaseDocket(mockContext, mockCaseId);
      expect(response).toEqual(expected);
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

      await expect(gateway._getCaseDocket(mockContext, mockCaseId)).rejects.toThrow(
        expectedMessage,
      );

      await expect(gateway._getCaseDocketDocuments(mockContext, mockCaseId)).rejects.toThrow(
        expectedMessage,
      );
    });

    test('should translate the gateway domain model to the use case model ', () => {
      const files = [
        {
          sequenceNumber: 0,
          uriStem: 'https://some.domain.gov/api/v1/path/to',
          fileName: '0208-173976-0-0-0.pdf',
          fileSize: 908038,
        },
        {
          sequenceNumber: 0,
          uriStem: 'https://some.domain.gov/api/v1/path/to',
          fileName: '0208-173976-0-0-1.pdf',
          fileSize: 2093190,
        },
        {
          sequenceNumber: 0,
          uriStem: 'https://some.domain.gov/api/v1/path/to',
          fileName: '0208-173976-0-0-2.pdf',
          fileSize: 1357930,
        },
        {
          sequenceNumber: 0,
          uriStem: 'https://some.domain.gov/api/v1/path/to',
          fileName: '0208-173976-2-1-3.pdf',
          fileSize: 4411203,
        },
        {
          sequenceNumber: 0,
          uriStem: 'https://some.domain.gov/api/v1/path/to',
          fileName: '02081739763240.pdf',
          fileSize: 4060318,
        },
      ];

      const expectedCaseDocketEntryDocuments = [
        {
          fileSize: 908038,
          fileUri: 'https://some.domain.gov/api/v1/path/to/0208-173976-0-0-0.pdf',
          fileLabel: '0-0',
          fileExt: 'pdf',
        },
        {
          fileUri: 'https://some.domain.gov/api/v1/path/to/0208-173976-0-0-1.pdf',
          fileLabel: '0-1',
          fileExt: 'pdf',
          fileSize: 2093190,
        },
        {
          fileUri: 'https://some.domain.gov/api/v1/path/to/0208-173976-0-0-2.pdf',
          fileLabel: '0-2',
          fileExt: 'pdf',
          fileSize: 1357930,
        },
        {
          fileUri: 'https://some.domain.gov/api/v1/path/to/0208-173976-2-1-3.pdf',
          fileLabel: '1-3',
          fileExt: 'pdf',
          fileSize: 4411203,
        },
        {
          fileUri: 'https://some.domain.gov/api/v1/path/to/02081739763240.pdf',
          fileLabel: '02081739763240.pdf',
          fileSize: 4060318,
        },
      ];

      const caseDocketEntries = translateModel(files);

      expect(caseDocketEntries).toEqual(expectedCaseDocketEntryDocuments);
    });

    test('should translate the gateway domain model to the use case model with a single record ', () => {
      const files = [
        {
          sequenceNumber: 0,
          uriStem: 'https://some.domain.gov/api/v1/path/to',
          fileName: '0208-173976-0-0-0.pdf',
          fileSize: 908038,
        },
      ];

      const expectedCaseDocketEntryDocuments = [
        {
          fileSize: 908038,
          fileUri: 'https://some.domain.gov/api/v1/path/to/0208-173976-0-0-0.pdf',
          fileLabel: '0',
          fileExt: 'pdf',
        },
      ];

      const caseDocketEntries = translateModel(files);

      expect(caseDocketEntries).toEqual(expectedCaseDocketEntryDocuments);
    });
  });

  describe('document sorter tests', () => {
    test('should properly handle numbers', () => {
      const fileOne = {
        sequenceNumber: 1,
        fileName: '',
        fileSize: 1000,
        uriStem: '',
        parts: ['4', '0', 'pdf'],
      };
      const fileTwo = {
        sequenceNumber: 1,
        fileName: '',
        fileSize: 1000,
        uriStem: '',
        parts: ['4', '1', 'pdf'],
      };
      expect(documentSorter(fileOne, fileTwo)).toEqual(-1);
      expect(documentSorter(fileTwo, fileOne)).toEqual(1);
    });

    test('should properly handle non-numeric', () => {
      const fileOne = {
        sequenceNumber: 1,
        fileName: 'abc.pdf',
        fileSize: 1000,
        uriStem: '',
        parts: ['4', 'a', 'pdf'],
      };
      const fileTwo = {
        sequenceNumber: 1,
        fileName: 'def.pdf',
        fileSize: 1000,
        uriStem: '',
        parts: ['4', '1', 'pdf'],
      };
      expect(documentSorter(fileOne, fileTwo)).toEqual(-1);
      expect(documentSorter(fileTwo, fileOne)).toEqual(1);
    });

    test('should properly handle not enough parts', () => {
      const fileOne = {
        sequenceNumber: 1,
        fileName: 'abc.pdf',
        fileSize: 1000,
        uriStem: '',
        parts: ['4'],
      };
      const fileTwo = {
        sequenceNumber: 1,
        fileName: 'def.pdf',
        fileSize: 1000,
        uriStem: '',
        parts: ['4', '1', 'pdf'],
      };
      expect(documentSorter(fileOne, fileTwo)).toEqual(-1);
      expect(documentSorter(fileTwo, fileOne)).toEqual(1);
    });
  });
});
