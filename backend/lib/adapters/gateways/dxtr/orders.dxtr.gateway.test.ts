import * as database from '../../utils/database';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { QueryResults } from '../../types/database';
import DxtrOrdersGateway, {
  DxtrOrder,
  DxtrOrderDocketEntry,
  DxtrOrderDocument,
  dxtrOrdersSorter,
} from './orders.dxtr.gateway';
import { ApplicationContext } from '../../types/basic';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';

function getEarliestDate(docket: DxtrOrderDocketEntry[]) {
  return docket.reduce<string>((earliestDate, de) => {
    if (!earliestDate || earliestDate > de.dateFiled) return de.dateFiled;
    return earliestDate;
  }, null);
}

const dxtrTransferCaseDocketEntries: DxtrOrderDocketEntry[] = [
  {
    docketSuggestedCaseNumber: '22-11111',
    rawRec: 'NNNNNN WARN: 22-11111',
    sequenceNumber: 0,
    dateFiled: '2023-12-01',
    txId: '1',
    dxtrCaseId: '11111',
    documentNumber: 0,
    summaryText: 'Summary Text',
    fullText: 'This is the full text.',
  },
  {
    rawRec: '',
    sequenceNumber: 1,
    dateFiled: '2023-11-01',
    txId: '2',
    dxtrCaseId: '11111',
    documentNumber: 1,
    summaryText: 'Some other Text',
    fullText: 'This is the other full text.',
  },
];

const dxtrTransferOrder: DxtrOrder = {
  ...MockData.getTransferOrder(),
  dxtrCaseId: '11111',
};

const dxtrTransferOrderDocument: DxtrOrderDocument = {
  txId: '1',
  sequenceNumber: 0,
  fileSize: 9999,
  uriStem: 'https://somedomain.gov/files',
  fileName: '0208-173976-0-0-0.pdf',
  deleted: 'N',
};

const dxtrConsolidationCaseDocketEntries1: DxtrOrderDocketEntry[] = [
  {
    docketSuggestedCaseNumber: '22-11111',
    rawRec: 'NNNNNN WARN: 22-11111',
    sequenceNumber: 0,
    dateFiled: '2023-12-01',
    txId: '3',
    dxtrCaseId: '11111',
    documentNumber: 0,
    summaryText: 'Summary Text',
    fullText: 'This is the full text.',
  },
  {
    rawRec: '',
    sequenceNumber: 1,
    dateFiled: '2023-11-01',
    txId: '4',
    dxtrCaseId: '11111',
    documentNumber: 1,
    summaryText: 'Some other Text',
    fullText: 'This is the other full text.',
  },
];

const dxtrConsolidationCaseDocketEntries2: DxtrOrderDocketEntry[] = [
  {
    docketSuggestedCaseNumber: '22-11111',
    rawRec: 'NNNNNN WARN: 22-11111',
    sequenceNumber: 0,
    dateFiled: '2023-12-01',
    txId: '5',
    dxtrCaseId: '22222',
    documentNumber: 0,
    summaryText: 'Summary Text',
    fullText: 'This is the full text.',
  },
  {
    rawRec: '',
    sequenceNumber: 1,
    dateFiled: '2023-11-01',
    txId: '6',
    dxtrCaseId: '22222',
    documentNumber: 1,
    summaryText: 'Some other Text',
    fullText: 'This is the other full text.',
  },
];

const dxtrConsolidationCaseDocketEntries = [
  ...dxtrConsolidationCaseDocketEntries1,
  ...dxtrConsolidationCaseDocketEntries2,
];

const dxtrConsolidationOrders: DxtrOrder[] = [
  {
    ...MockData.getConsolidationOrder(),
    dxtrCaseId: '11111',
  },
  {
    ...MockData.getConsolidationOrder(),
    dxtrCaseId: '22222',
  },
];

const dxtrConsolidationOrderDocument: DxtrOrderDocument = {
  txId: '1',
  sequenceNumber: 0,
  fileSize: 9999,
  uriStem: 'https://somedomain.gov/files',
  fileName: '0208-173976-0-0-0.pdf',
  deleted: 'N',
};

function buildSuccessfulQueryResult(recordset: Array<unknown> = []) {
  const orderDocumentResults: QueryResults = {
    success: true,
    results: {
      recordset: recordset,
    },
    message: '',
  };
  return orderDocumentResults;
}

describe('DxtrOrdersGateway', () => {
  describe('getOrders', () => {
    let applicationContext: ApplicationContext;
    const querySpy = jest.spyOn(database, 'executeQuery');

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext();
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
      const applicationContext = await createMockApplicationContext();
      const querySpy = jest.spyOn(database, 'executeQuery');

      const consolidtionOrdersResults = buildSuccessfulQueryResult(dxtrConsolidationOrders);
      const consolidationDocketEntryResults = buildSuccessfulQueryResult(
        dxtrConsolidationCaseDocketEntries,
      );
      const consolidationDocumentResults = buildSuccessfulQueryResult([
        dxtrConsolidationOrderDocument,
      ]);

      const transferOrdersResults = buildSuccessfulQueryResult([dxtrTransferOrder]);
      const transferDocketEntryResults = buildSuccessfulQueryResult(dxtrTransferCaseDocketEntries);
      const transferDocumentResults = buildSuccessfulQueryResult([dxtrTransferOrderDocument]);
      querySpy
        .mockResolvedValueOnce(transferOrdersResults)
        .mockResolvedValueOnce(transferDocketEntryResults)
        .mockResolvedValueOnce(transferDocumentResults)
        .mockResolvedValueOnce(consolidtionOrdersResults)
        .mockResolvedValueOnce(consolidationDocketEntryResults)
        .mockResolvedValueOnce(consolidationDocumentResults);

      const gateway = new DxtrOrdersGateway();
      const orderSync = await gateway.getOrderSync(applicationContext, '0');
      expect(orderSync.maxTxId).toEqual('6');
      expect(orderSync.transfers[0].orderDate).toEqual(
        getEarliestDate(dxtrTransferCaseDocketEntries),
      );

      const firstConsolidation = orderSync.consolidations[0];
      const secondConsolidation = orderSync.consolidations[1];

      expect(firstConsolidation.orderDate).toEqual(
        getEarliestDate(dxtrConsolidationCaseDocketEntries1),
      );
      expect(secondConsolidation.orderDate).toEqual(
        getEarliestDate(dxtrConsolidationCaseDocketEntries2),
      );
    });

    test('should add chapters enabled by feature flags', async () => {
      const gateway = new DxtrOrdersGateway();

      const querySpy = jest.spyOn(database, 'executeQuery');
      const mockOrdersResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrTransferOrder],
        },
        message: '',
      };

      const mockDocumentsResults: QueryResults = {
        success: true,
        results: {
          recordset: [dxtrTransferOrderDocument],
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
      const applicationContext = await createMockApplicationContext();
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
          recordset: [dxtrTransferOrderDocument],
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
          recordset: [dxtrTransferOrder],
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
          recordset: [dxtrTransferOrder],
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
