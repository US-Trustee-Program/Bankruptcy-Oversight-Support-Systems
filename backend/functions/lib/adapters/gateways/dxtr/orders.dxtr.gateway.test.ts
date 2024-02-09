import * as database from '../../utils/database';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { QueryResults } from '../../types/database';
import {
  DxtrOrder,
  DxtrOrderDocketEntry,
  DxtrOrderDocument,
  DxtrOrdersGateway,
  dxtrOrdersSorter,
} from './orders.dxtr.gateway';
import { TransferOrder } from '../../../../../../common/src/cams/orders';
import { ApplicationContext } from '../../types/basic';

const dxtrCaseDocketEntries: DxtrOrderDocketEntry[] = [
  {
    newCaseId: '22-111111',
    rawRec: 'NNNNNN WARN: 22-111111',
    sequenceNumber: 0,
    dateFiled: '2023-12-01',
    txId: '1',
    dxtrCaseId: '111111',
    documentNumber: 0,
    summaryText: 'Summary Text',
    fullText: 'This is the full text.',
  },
  {
    rawRec: '',
    sequenceNumber: 1,
    dateFiled: '2023-12-01',
    txId: '2',
    dxtrCaseId: '111111',
    documentNumber: 1,
    summaryText: 'Some other Text',
    fullText: 'This is the other full text.',
  },
];

const dxtrOrder: DxtrOrder = {
  dxtrCaseId: '111111',
  dateFiled: '2023-12-01',
  caseId: '081-23-111111',
  caseTitle: 'Mr Bean',
  chapter: '15',
  courtName: '',
  courtDivisionName: '',
  regionId: '',
  orderType: 'transfer',
  orderDate: '2023-12-01',
  status: 'pending',
  courtDivision: '081',
  docketEntries: [],
};

const dxtrOrderDocument: DxtrOrderDocument = {
  txId: '1',
  sequenceNumber: 0,
  fileSize: 9999,
  uriStem: 'https://somedomain.gov/files',
  fileName: '0208-173976-0-0-0.pdf',
  deleted: 'N',
};

const expectedOrder: TransferOrder = {
  dateFiled: '2023-12-01',
  caseId: '081-23-111111',
  caseTitle: 'Mr Bean',
  chapter: '15',
  courtName: '',
  courtDivisionName: '',
  courtDivision: '081',
  regionId: '',
  orderType: 'transfer',
  orderDate: '2023-12-01',
  status: 'pending',
  newCaseId: '22-111111',
  docketEntries: [
    {
      sequenceNumber: 0,
      dateFiled: '2023-12-01',
      summaryText: 'Summary Text',
      fullText: 'This is the full text.',
      documentNumber: 0,
      documents: [
        {
          fileSize: 9999,
          fileUri: 'https://somedomain.gov/files/0208-173976-0-0-0.pdf',
          fileLabel: '0',
          fileExt: 'pdf',
        },
      ],
    },
    {
      sequenceNumber: 1,
      dateFiled: '2023-12-01',
      documentNumber: 1,
      summaryText: 'Some other Text',
      fullText: 'This is the other full text.',
    },
  ],
};

describe('DxtrOrdersGateway', () => {
  describe('getOrders', () => {
    let applicationContext: ApplicationContext;
    const querySpy = jest.spyOn(database, 'executeQuery');

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      querySpy.mockImplementation(jest.fn());
    });

    afterEach(() => {
      querySpy.mockReset();
    });

    test('should sort orders', () => {
      const testList: { orderDate: string }[] = [
        { orderDate: '2024-01-01' },
        { orderDate: '2023-01-01' },
        { orderDate: '2022-01-01' },
        { orderDate: '2024-01-01' },
      ];
      const expectedList: { orderDate: string }[] = [
        { orderDate: '2022-01-01' },
        { orderDate: '2023-01-01' },
        { orderDate: '2024-01-01' },
        { orderDate: '2024-01-01' },
      ];
      const actualList = testList.sort(dxtrOrdersSorter);
      expect(actualList).toEqual(expectedList);
    });

    test('should return a list of orders', async () => {
      const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      const querySpy = jest.spyOn(database, 'executeQuery');

      const mockOrdersResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrOrder],
        },
        message: '',
      };

      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockOrdersResults);
      });

      const mockDocumentsDocketEntryResults: QueryResults = {
        success: true,
        results: {
          recordset: dxtrCaseDocketEntries,
        },
        message: '',
      };

      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockDocumentsDocketEntryResults);
      });

      const mockDocumentsResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrOrderDocument],
        },
        message: '',
      };

      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockDocumentsResults);
      });

      const gateway = new DxtrOrdersGateway();
      const orderSync = await gateway.getOrderSync(applicationContext, '0');
      expect(orderSync.orders).toEqual([expectedOrder]);
      expect(orderSync.maxTxId).toEqual('2');
    });

    test('should add chapters enabled by feature flags', async () => {
      const gateway = new DxtrOrdersGateway();

      const querySpy = jest.spyOn(database, 'executeQuery');
      const mockOrdersResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrOrder],
        },
        message: '',
      };

      const mockDocumentsResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrOrderDocument],
        },
        message: '',
      };

      applicationContext.featureFlags = {};
      querySpy.mockResolvedValue(mockOrdersResults);
      querySpy.mockResolvedValueOnce(mockDocumentsResults);

      await gateway.getOrderSync(applicationContext, '0');
      expect(querySpy).toHaveBeenCalled(); //"CS.CS_CHAPTER IN ('15')"

      applicationContext.featureFlags = {
        'chapter-eleven-enabled': true,
        'chapter-twelve-enabled': true,
      };

      querySpy.mockResolvedValue(mockOrdersResults);
      querySpy.mockResolvedValueOnce(mockDocumentsResults);

      await gateway.getOrderSync(applicationContext, '0');
      expect(querySpy).toHaveBeenCalled(); // "CS.CS_CHAPTER IN ('15','11','12')"
    });

    test('should handle thrown errors from _getOrders', async () => {
      const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      const querySpy = jest.spyOn(database, 'executeQuery');

      const expectedErrorMessage = 'some warning from the orders query';
      const mockOrdersResults: QueryResults = {
        success: false,
        message: expectedErrorMessage,
        results: undefined,
      };

      const mockDocumentsResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrOrderDocument],
        },
        message: '',
      };

      let callSequence = 0;
      querySpy.mockImplementation(async () => {
        callSequence++;
        if (callSequence === 1) {
          return Promise.resolve(mockOrdersResults);
        } else {
          return Promise.resolve(mockDocumentsResults);
        }
      });

      const gateway = new DxtrOrdersGateway();
      await expect(gateway.getOrderSync(applicationContext, '0')).rejects.toThrow(
        expectedErrorMessage,
      );
    });

    test('should handle thrown errors from _getDocuments', async () => {
      const mockOrdersResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrOrder],
        },
        message: '',
      };

      const expectedErrorMessage = 'some warning from the documents query';
      const mockDocumentsResults: QueryResults = {
        success: false,
        message: expectedErrorMessage,
        results: undefined,
      };

      let callSequence = 0;
      querySpy.mockImplementation(async () => {
        callSequence++;
        if (callSequence === 1) {
          return Promise.resolve(mockOrdersResults);
        } else {
          return Promise.resolve(mockDocumentsResults);
        }
      });

      const gateway = new DxtrOrdersGateway();
      await expect(gateway.getOrderSync(applicationContext, '0')).rejects.toThrow(
        expectedErrorMessage,
      );
      querySpy.mockReset();
    });

    test('_getOrderDocuments should throw a CamsError when the query execution fails', async () => {
      const mockOrdersResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrOrder],
        },
        message: '',
      };

      const mockDocketEntries: QueryResults = {
        success: true,
        message: '',
        results: {
          recordset: [],
        },
      };

      const expectedErrorMessage = 'some warning from the documents query';
      const mockDocumentsResults: QueryResults = {
        success: false,
        message: expectedErrorMessage,
        results: undefined,
      };

      let callSequence = 0;
      querySpy.mockImplementation(async () => {
        callSequence++;
        if (callSequence === 1) {
          return Promise.resolve(mockOrdersResults);
        } else if (callSequence === 2) {
          return Promise.resolve(mockDocketEntries);
        } else {
          return Promise.resolve(mockDocumentsResults);
        }
      });

      const gateway = new DxtrOrdersGateway();
      await expect(gateway.getOrderSync(applicationContext, '0')).rejects.toThrow(
        expectedErrorMessage,
      );
      querySpy.mockReset();
    });
  });
});
