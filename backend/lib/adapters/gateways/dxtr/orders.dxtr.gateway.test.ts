import { vi } from 'vitest';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { QueryResults } from '../../types/database';
import DxtrOrdersGateway, {
  DxtrOrder,
  DxtrOrderDocketEntry,
  DxtrOrderDocument,
  dxtrOrdersSorter,
} from './orders.dxtr.gateway';
import { ApplicationContext } from '../../types/basic';
import MockData from '@common/cams/test-utilities/mock-data';
import { AbstractMssqlClient } from '../abstract-mssql-client';

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
  return {
    success: true,
    results: { recordset },
    message: '',
  } as QueryResults;
}

describe('DxtrOrdersGateway', () => {
  describe('getOrders', () => {
    let applicationContext: ApplicationContext;
    let querySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext();
      querySpy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery');
    });

    afterEach(() => {
      vi.restoreAllMocks();
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

    test('should return a list of orders with correct order dates derived from earliest docket entry', async () => {
      querySpy
        .mockResolvedValueOnce(buildSuccessfulQueryResult([dxtrTransferOrder]))
        .mockResolvedValueOnce(buildSuccessfulQueryResult(dxtrTransferCaseDocketEntries))
        .mockResolvedValueOnce(buildSuccessfulQueryResult([dxtrTransferOrderDocument]))
        .mockResolvedValueOnce(buildSuccessfulQueryResult(dxtrConsolidationOrders))
        .mockResolvedValueOnce(buildSuccessfulQueryResult(dxtrConsolidationCaseDocketEntries))
        .mockResolvedValueOnce(buildSuccessfulQueryResult([dxtrConsolidationOrderDocument]));

      const gateway = new DxtrOrdersGateway(applicationContext);
      const orderSync = await gateway.getOrderSync(applicationContext, '0');

      expect(orderSync.maxTxId).toEqual('6');
      // Earliest date across dxtrTransferCaseDocketEntries is 2023-11-01
      expect(orderSync.transfers[0].orderDate).toEqual('2023-11-01');
      // Earliest date across dxtrConsolidationCaseDocketEntries1 is 2023-11-01
      expect(orderSync.consolidations[0].orderDate).toEqual('2023-11-01');
      // Earliest date across dxtrConsolidationCaseDocketEntries2 is 2023-11-01
      expect(orderSync.consolidations[1].orderDate).toEqual('2023-11-01');
    });

    test.each([
      {
        description: 'should include only chapter 15 when no feature flags are set',
        featureFlags: {},
        expectedChapterClause: "CS.CS_CHAPTER IN ('15')",
      },
      {
        description: 'should include chapters 11 and 12 when feature flags are enabled',
        featureFlags: { 'chapter-eleven-enabled': true, 'chapter-twelve-enabled': true },
        expectedChapterClause: "CS.CS_CHAPTER IN ('15','11','12')",
      },
    ])('$description', async ({ featureFlags, expectedChapterClause }) => {
      applicationContext.featureFlags = featureFlags;

      querySpy.mockResolvedValue(buildSuccessfulQueryResult([]));

      const gateway = new DxtrOrdersGateway(applicationContext);
      await gateway.getOrderSync(applicationContext, '0');

      const queryString = querySpy.mock.calls[0][1] as string;
      expect(queryString).toContain(expectedChapterClause);
    });

    test('should throw when the orders query fails', async () => {
      const expectedErrorMessage = 'some warning from the orders query';

      querySpy.mockResolvedValueOnce({
        success: false,
        message: expectedErrorMessage,
        results: undefined,
      });

      const gateway = new DxtrOrdersGateway(applicationContext);
      await expect(gateway.getOrderSync(applicationContext, '0')).rejects.toThrow(
        expect.objectContaining({
          message: expectedErrorMessage,
          status: 500,
          module: 'ORDERS-DXTR-GATEWAY',
        }),
      );
    });

    test.each([
      {
        description:
          'should throw when documents query fails after successful orders and docket entries',
        mocks: (spy: ReturnType<typeof vi.spyOn>, errorMessage: string) => {
          spy
            .mockResolvedValueOnce(buildSuccessfulQueryResult([dxtrTransferOrder]))
            .mockResolvedValueOnce(buildSuccessfulQueryResult(dxtrTransferCaseDocketEntries))
            .mockResolvedValueOnce({ success: false, message: errorMessage, results: undefined });
        },
      },
      {
        description: 'should throw when docket entries query fails after successful orders',
        mocks: (spy: ReturnType<typeof vi.spyOn>, errorMessage: string) => {
          spy
            .mockResolvedValueOnce(buildSuccessfulQueryResult([dxtrTransferOrder]))
            .mockResolvedValueOnce({ success: false, message: errorMessage, results: undefined });
        },
      },
    ])('$description', async ({ mocks }) => {
      const expectedErrorMessage = 'some warning from the documents query';
      mocks(querySpy, expectedErrorMessage);

      const gateway = new DxtrOrdersGateway(applicationContext);
      await expect(gateway.getOrderSync(applicationContext, '0')).rejects.toThrow(
        expect.objectContaining({
          message: expectedErrorMessage,
          status: 500,
          module: 'ORDERS-DXTR-GATEWAY',
        }),
      );
    });
  });
});
