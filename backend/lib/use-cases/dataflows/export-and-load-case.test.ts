import { vi } from 'vitest';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import MockData from '@common/cams/test-utilities/mock-data';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { getCamsError } from '../../common-errors/error-utilities';
import { UnknownError } from '../../common-errors/unknown-error';
import { NotFoundError } from '../../common-errors/not-found-error';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import ExportAndLoadCase from './export-and-load-case';
import { CaseDetail, DxtrCase, SyncedCase } from '@common/cams/cases';

function mockCaseSyncEvent(override: Partial<CaseSyncEvent> = {}): CaseSyncEvent {
  return {
    type: 'CASE_CHANGED',
    caseId: '000-00-00000',
    ...override,
  };
}

describe('Export and Load Case Tests', () => {
  let context;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  describe('exportAndLoadCase', () => {
    test('should return list of events with case details on each', async () => {
      const mockCaseDetails = MockData.getCaseDetail();
      const events = MockData.buildArray(mockCaseSyncEvent, 3);

      const exportSpy = vi
        .spyOn(CasesLocalGateway.prototype, 'getCaseDetail')
        .mockResolvedValue(mockCaseDetails);
      const loadSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      const actual = await ExportAndLoadCase.exportAndLoad(context, events);
      const expected: CaseSyncEvent[] = events.map((event) => {
        return {
          ...event,
          bCase: mockCaseDetails,
        };
      });

      expect(exportSpy).toHaveBeenCalledTimes(events.length);
      expect(loadSpy).toHaveBeenCalledTimes(events.length);
      expect(actual).toEqual(expected);
    });

    test('should return a list of events with an error on each event', async () => {
      const events = MockData.buildArray(mockCaseSyncEvent, 3);

      const error = new Error('some error');
      const expectedError = getCamsError(error, expect.anything(), expect.any(String));

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(error);
      const actual = await ExportAndLoadCase.exportAndLoad(context, events);

      actual.forEach((event) => {
        expect(event.error).toEqual(expect.objectContaining(expectedError));
      });
    });
  });

  describe('exportCase', () => {
    test('should return CaseDetail on event', async () => {
      const mockCaseDetails = MockData.getCaseDetail();
      const event = mockCaseSyncEvent();
      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(mockCaseDetails);
      const actual = await ExportAndLoadCase.exportCase(context, event);
      const expected: CaseSyncEvent = {
        ...event,
        bCase: mockCaseDetails,
      };
      expect(actual).toEqual(expected);
    });

    test('should return an error on the event', async () => {
      const event = mockCaseSyncEvent();

      const error = new Error('some error');
      const expected = getCamsError(error, expect.anything(), expect.any(String));

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(error);
      const actual = await ExportAndLoadCase.exportCase(context, event);

      expect(actual.error).toEqual(expect.objectContaining(expected));
    });
  });

  describe('loadCase', () => {
    test('should persist a SyncedCase', async () => {
      const bCase = MockData.getDxtrCase();
      const event = mockCaseSyncEvent({ bCase });

      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.loadCase(context, event);

      expect(syncSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...bCase,
          debtor: expect.objectContaining({
            ...bCase.debtor,
            phoneticTokens: expect.any(Array),
          }),
          documentType: 'SYNCED_CASE',
          updatedBy: SYSTEM_USER_REFERENCE,
          updatedOn: expect.any(String),
          createdBy: SYSTEM_USER_REFERENCE,
          createdOn: expect.any(String),
        }),
      );
    });

    test('should return an error on the event', async () => {
      const bCase = MockData.getDxtrCase();
      const event = mockCaseSyncEvent({ bCase });
      const error = new UnknownError('test-module');
      vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockRejectedValue(error);

      const expected = new UnknownError(expect.anything(), {
        camsStackInfo: {
          message: expect.any(String),
          module: 'EXPORT-AND-LOAD',
        },
      });

      const actual = await ExportAndLoadCase.loadCase(context, event);
      expect(actual.error).toEqual(expect.objectContaining(expected));
    });

    test('should add phonetic tokens to debtor name when loading case', async () => {
      const debtorName = 'Michael Johnson';
      const bCase = MockData.getDxtrCase({
        override: {
          debtor: { name: debtorName },
        },
      });
      const event = mockCaseSyncEvent({ bCase });

      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.loadCase(context, event);

      const syncedCase = syncSpy.mock.calls[0][0];
      expect(syncedCase.debtor.phoneticTokens).toBeDefined();
      expect(syncedCase.debtor.phoneticTokens.length).toBeGreaterThan(0);
      expect(syncedCase.debtor.phoneticTokens).toContain('M240');
      expect(syncedCase.debtor.phoneticTokens).toContain('MKSHL');
      expect(syncedCase.debtor.phoneticTokens).toContain('J525');
    });

    test('should add phonetic tokens to joint debtor name when loading case', async () => {
      const debtorName = 'John Smith';
      const jointDebtorName = 'Sarah Connor';
      const bCase = MockData.getDxtrCase({
        override: {
          debtor: { name: debtorName },
          jointDebtor: { name: jointDebtorName },
        },
      });
      const event = mockCaseSyncEvent({ bCase });

      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.loadCase(context, event);

      const syncedCase = syncSpy.mock.calls[0][0];
      expect(syncedCase.debtor.phoneticTokens).toBeDefined();
      expect(syncedCase.debtor.phoneticTokens.length).toBeGreaterThan(0);
      expect(syncedCase.debtor.phoneticTokens).toContain('J500');

      expect(syncedCase.jointDebtor.phoneticTokens).toBeDefined();
      expect(syncedCase.jointDebtor.phoneticTokens.length).toBeGreaterThan(0);
      expect(syncedCase.jointDebtor.phoneticTokens).toContain('S600');
    });

    test('should handle case without debtor name gracefully', async () => {
      const bCase = MockData.getDxtrCase({
        override: {
          debtor: { name: undefined },
        },
      });
      const event = mockCaseSyncEvent({ bCase });

      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.loadCase(context, event);

      const syncedCase = syncSpy.mock.calls[0][0];
      expect(syncedCase.debtor.phoneticTokens).toBeUndefined();
    });
  });

  describe('exportAndLoad phonetic token generation', () => {
    test('should add phonetic tokens to all cases during exportAndLoad', async () => {
      const mockCaseDetails = MockData.getCaseDetail({
        override: {
          debtor: { name: 'Michael Johnson' },
          jointDebtor: { name: 'Sarah Connor' },
        },
      });
      const events = MockData.buildArray(mockCaseSyncEvent, 2);

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(mockCaseDetails);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.exportAndLoad(context, events);

      expect(syncSpy).toHaveBeenCalledTimes(events.length);

      syncSpy.mock.calls.forEach((call) => {
        const syncedCase = call[0];
        expect(syncedCase.debtor.phoneticTokens).toBeDefined();
        expect(syncedCase.debtor.phoneticTokens.length).toBeGreaterThan(0);
        expect(syncedCase.jointDebtor.phoneticTokens).toBeDefined();
        expect(syncedCase.jointDebtor.phoneticTokens.length).toBeGreaterThan(0);
      });
    });

    test('should generate consistent phonetic tokens for same name', async () => {
      const debtorName = 'John Smith';
      const mockCaseDetails = MockData.getCaseDetail({
        override: {
          debtor: { name: debtorName },
        },
      });
      const events = MockData.buildArray(mockCaseSyncEvent, 2);

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(mockCaseDetails);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.exportAndLoad(context, events);

      const firstCallTokens = syncSpy.mock.calls[0][0].debtor.phoneticTokens;
      const secondCallTokens = syncSpy.mock.calls[1][0].debtor.phoneticTokens;

      expect(firstCallTokens).toEqual(secondCallTokens);
    });

    test.each([
      { name: 'John Smith', expectedTokens: ['J500', 'JN', 'S530', 'SM0'] },
      { name: 'Michael Johnson', expectedTokens: ['M240', 'MKSHL', 'J525', 'JNSN'] },
      { name: 'Sarah Connor', expectedTokens: ['S600', 'SR', 'C560', 'KNR'] },
      { name: "O'Brien", expectedTokens: ['O165', 'OBRN'] },
    ])('should generate correct phonetic tokens for "$name"', async ({ name, expectedTokens }) => {
      const mockCaseDetails = MockData.getCaseDetail({
        override: {
          debtor: { name },
        },
      });
      const events = [mockCaseSyncEvent()];

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(mockCaseDetails);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.exportAndLoad(context, events);

      const syncedCase = syncSpy.mock.calls[0][0];
      const actualTokens = syncedCase.debtor.phoneticTokens;

      expect(actualTokens).toBeDefined();
      expect(actualTokens.length).toBeGreaterThan(0);
      expectedTokens.forEach((expectedToken) => {
        expect(actualTokens).toContain(expectedToken);
      });
    });

    test('should generate both bigrams and phonetic tokens at load time', async () => {
      const mockCaseDetails = MockData.getCaseDetail({
        override: {
          debtor: { name: 'Mike Johnson' },
        },
      });
      const events = [mockCaseSyncEvent()];

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(mockCaseDetails);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.exportAndLoad(context, events);

      const syncedCase = syncSpy.mock.calls[0][0];
      const actualTokens = syncedCase.debtor.phoneticTokens;

      expect(actualTokens).toBeDefined();
      expect(actualTokens.length).toBeGreaterThan(0);

      expect(actualTokens).toContain('M200');
      expect(actualTokens).toContain('MK');

      expect(actualTokens).toContain('J525');
      expect(actualTokens).toContain('JNSN');

      expect(actualTokens).toContain('mi');
      expect(actualTokens).toContain('ik');
      expect(actualTokens).toContain('ke');
      expect(actualTokens).toContain('jo');
      expect(actualTokens).toContain('oh');
      expect(actualTokens).toContain('hn');
    });

    test('should preserve other case properties when adding phonetic tokens', async () => {
      const mockCaseDetails = MockData.getCaseDetail({
        override: {
          caseId: '24-12345',
          debtor: {
            name: 'John Smith',
            address1: '123 Main St',
            cityStateZipCountry: 'New York, NY 10001',
          },
          chapter: '7',
        },
      });
      const events = [mockCaseSyncEvent()];

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(mockCaseDetails);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.exportAndLoad(context, events);

      const syncedCase = syncSpy.mock.calls[0][0];

      expect(syncedCase.debtor.phoneticTokens).toBeDefined();

      expect(syncedCase.caseId).toBe('24-12345');
      expect(syncedCase.debtor.name).toBe('John Smith');
      expect(syncedCase.debtor.address1).toBe('123 Main St');
      expect(syncedCase.chapter).toBe('7');
    });
  });

  describe('exportAndLoad - division change detection', () => {
    test('should detect division change and set divisionChange on event', async () => {
      const existingCase = MockData.getSyncedCase({
        override: {
          caseId: '081-24-12345',
          dxtrId: '081-1234567',
          courtId: '081',
        },
      });

      const newCase = MockData.getCaseDetail({
        override: {
          caseId: '081-24-67890',
          dxtrId: '081-1234567',
          courtId: '081',
        },
      });

      const events = [mockCaseSyncEvent({ caseId: newCase.caseId })];

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(newCase);
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findSyncedCaseByDxtrId')
        .mockResolvedValue(existingCase);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      const result = await ExportAndLoadCase.exportAndLoad(context, events);

      expect(findSpy).toHaveBeenCalledWith(newCase.dxtrId, newCase.courtId);
      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(result[0].divisionChange).toEqual({
        orphanedCaseId: existingCase.caseId,
        currentCaseId: newCase.caseId,
      });
      expect(result[0].error).toBeUndefined();
    });

    test('should not set divisionChange when no existing case found', async () => {
      const newCase = MockData.getCaseDetail({
        override: {
          caseId: '081-24-67890',
          dxtrId: '081-1234567',
          courtId: '081',
        },
      });

      const events = [mockCaseSyncEvent({ caseId: newCase.caseId })];

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(newCase);
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findSyncedCaseByDxtrId')
        .mockResolvedValue(undefined);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      const result = await ExportAndLoadCase.exportAndLoad(context, events);

      expect(findSpy).toHaveBeenCalledWith(newCase.dxtrId, newCase.courtId);
      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(result[0].divisionChange).toBeUndefined();
      expect(result[0].error).toBeUndefined();
    });

    test('should not set divisionChange when existing caseId matches new caseId', async () => {
      const existingCase = MockData.getSyncedCase({
        override: {
          caseId: '081-24-12345',
          dxtrId: '081-1234567',
          courtId: '081',
        },
      });

      const newCase = MockData.getCaseDetail({
        override: {
          caseId: '081-24-12345',
          dxtrId: '081-1234567',
          courtId: '081',
        },
      });

      const events = [mockCaseSyncEvent({ caseId: newCase.caseId })];

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(newCase);
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findSyncedCaseByDxtrId')
        .mockResolvedValue(existingCase);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      const result = await ExportAndLoadCase.exportAndLoad(context, events);

      expect(findSpy).toHaveBeenCalledWith(newCase.dxtrId, newCase.courtId);
      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(result[0].divisionChange).toBeUndefined();
      expect(result[0].error).toBeUndefined();
    });

    test('should log but continue sync if division change detection fails', async () => {
      const newCase = MockData.getCaseDetail({
        override: {
          caseId: '081-24-67890',
          dxtrId: '081-1234567',
          courtId: '081',
        },
      });

      const events = [mockCaseSyncEvent({ caseId: newCase.caseId })];

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(newCase);
      const detectionError = new Error('Database connection failed');
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findSyncedCaseByDxtrId')
        .mockRejectedValue(detectionError);
      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();
      const logSpy = vi.spyOn(context.logger, 'error');

      const result = await ExportAndLoadCase.exportAndLoad(context, events);

      expect(findSpy).toHaveBeenCalledWith(newCase.dxtrId, newCase.courtId);
      expect(logSpy).toHaveBeenCalledWith(
        'EXPORT-AND-LOAD',
        expect.stringContaining('Division change detection failed'),
      );
      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(result[0].divisionChange).toBeUndefined();
      expect(result[0].error).toBeUndefined();
    });

    test('should continue to process remaining events if one has division change', async () => {
      const existingCase = MockData.getSyncedCase({
        override: {
          caseId: '081-24-11111',
          dxtrId: '081-1111111',
          courtId: '081',
        },
      });

      const divisionChangeCase = MockData.getCaseDetail({
        override: {
          caseId: '081-24-22222',
          dxtrId: '081-1111111',
          courtId: '081',
        },
      });

      const normalCase = MockData.getCaseDetail({
        override: {
          caseId: '081-24-33333',
          dxtrId: '081-3333333',
          courtId: '081',
        },
      });

      const events = [
        mockCaseSyncEvent({ caseId: divisionChangeCase.caseId }),
        mockCaseSyncEvent({ caseId: normalCase.caseId }),
      ];

      const getCaseDetailSpy = vi
        .spyOn(CasesLocalGateway.prototype, 'getCaseDetail')
        .mockImplementation(async (_context, caseId) => {
          if (caseId === divisionChangeCase.caseId) return divisionChangeCase;
          if (caseId === normalCase.caseId) return normalCase;
          throw new Error('Unexpected caseId');
        });

      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findSyncedCaseByDxtrId')
        .mockImplementation(async (dxtrId) => {
          if (dxtrId === divisionChangeCase.dxtrId) return existingCase;
          return undefined;
        });

      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      const result = await ExportAndLoadCase.exportAndLoad(context, events);

      expect(getCaseDetailSpy).toHaveBeenCalledTimes(2);
      expect(findSpy).toHaveBeenCalledTimes(2);
      expect(syncSpy).toHaveBeenCalledTimes(2);

      expect(result[0].divisionChange).toEqual({
        orphanedCaseId: existingCase.caseId,
        currentCaseId: divisionChangeCase.caseId,
      });
      expect(result[0].error).toBeUndefined();

      expect(result[1].divisionChange).toBeUndefined();
      expect(result[1].error).toBeUndefined();
    });
  });

  describe('exportAndLoad - NotFoundError recovery via division change lookup', () => {
    test('should set divisionChange and clear error when getCaseDetail throws NotFoundError and DXTR returns a case with a different caseId', async () => {
      const orphanedCaseId = '121-26-13490';
      const currentCaseId = '081-26-13490';
      const dxtrId = '121-1234567';
      const courtId = '121';

      const syncedCase = MockData.getSyncedCase({
        override: { caseId: orphanedCaseId, dxtrId, courtId },
      });

      const dxtrCase = MockData.getCaseDetail({
        override: { caseId: currentCaseId, dxtrId, courtId },
      });

      const event = mockCaseSyncEvent({ caseId: orphanedCaseId });

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(
        new NotFoundError('TEST'),
      );
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);
      vi.spyOn(CasesLocalGateway.prototype, 'searchCases').mockResolvedValue([dxtrCase]);

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(result.divisionChange).toEqual({
        orphanedCaseId,
        currentCaseId,
      });
      expect(result.error).toBeUndefined();
    });

    test('should set error when getCaseDetail throws NotFoundError and DXTR returns a case with the same caseId', async () => {
      const caseId = '121-26-13490';
      const dxtrId = '121-1234567';
      const courtId = '121';

      const syncedCase = MockData.getSyncedCase({ override: { caseId, dxtrId, courtId } });
      const dxtrCase = MockData.getCaseDetail({ override: { caseId, dxtrId, courtId } });

      const event = mockCaseSyncEvent({ caseId });

      const notFoundError = new NotFoundError('TEST');
      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(notFoundError);
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);
      vi.spyOn(CasesLocalGateway.prototype, 'searchCases').mockResolvedValue([dxtrCase]);

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(result.divisionChange).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should set error when getCaseDetail throws NotFoundError and DXTR returns an empty array', async () => {
      const caseId = '121-26-13490';
      const dxtrId = '121-1234567';
      const courtId = '121';

      const syncedCase = MockData.getSyncedCase({ override: { caseId, dxtrId, courtId } });

      const event = mockCaseSyncEvent({ caseId });

      const notFoundError = new NotFoundError('TEST');
      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(notFoundError);
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);
      vi.spyOn(CasesLocalGateway.prototype, 'searchCases').mockResolvedValue([]);

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(result.divisionChange).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should set error when getCaseDetail throws NotFoundError and getSyncedCase throws', async () => {
      const caseId = '121-26-13490';
      const event = mockCaseSyncEvent({ caseId });

      const notFoundError = new NotFoundError('TEST');
      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(notFoundError);
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockRejectedValue(
        new Error('Cosmos lookup failed'),
      );

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(result.divisionChange).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should set error when getCaseDetail throws NotFoundError and searchCases throws', async () => {
      const caseId = '121-26-13490';
      const dxtrId = '121-1234567';
      const courtId = '121';

      const syncedCase = MockData.getSyncedCase({ override: { caseId, dxtrId, courtId } });
      const event = mockCaseSyncEvent({ caseId });

      const notFoundError = new NotFoundError('TEST');
      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(notFoundError);
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);
      vi.spyOn(CasesLocalGateway.prototype, 'searchCases').mockRejectedValue(
        new Error('DXTR search failed'),
      );

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(result.divisionChange).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should set error when getCaseDetail throws a non-NotFoundError', async () => {
      const event = mockCaseSyncEvent();

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(
        new Error('some other error'),
      );

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(result.divisionChange).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should warn and still set divisionChange when searchCases returns multiple results', async () => {
      const orphanedCaseId = '121-26-13490';
      const currentCaseId = '081-26-13490';
      const secondCaseId = '082-26-13490';
      const dxtrId = '121-1234567';
      const courtId = '121';

      const syncedCase = MockData.getSyncedCase({
        override: { caseId: orphanedCaseId, dxtrId, courtId },
      });

      const firstDxtrCase = MockData.getCaseDetail({
        override: { caseId: currentCaseId, dxtrId, courtId },
      });

      const secondDxtrCase = MockData.getCaseDetail({
        override: { caseId: secondCaseId, dxtrId, courtId },
      });

      const event = mockCaseSyncEvent({ caseId: orphanedCaseId });

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockRejectedValue(
        new NotFoundError('TEST'),
      );
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);
      vi.spyOn(CasesLocalGateway.prototype, 'searchCases').mockResolvedValue([
        firstDxtrCase,
        secondDxtrCase,
      ]);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(warnSpy).toHaveBeenCalledWith(
        'EXPORT-AND-LOAD',
        expect.stringContaining('Ambiguous DXTR results'),
      );
      expect(result.divisionChange).toEqual({
        orphanedCaseId,
        currentCaseId,
      });
      expect(result.error).toBeUndefined();
    });

    test('should call updateCaseFields when relevant fields changed during sync', async () => {
      const originalCase = MockData.getDxtrCase({
        override: {
          caseId: '081-24-12345',
          dateFiled: '2023-01-01',
          chapter: '7',
          courtDivisionCode: 'DIV001',
          closedDate: undefined,
          reopenedDate: undefined,
          debtor: { name: 'Test Debtor' },
          dxtrId: '12345',
          courtId: '001',
        } satisfies Partial<DxtrCase>,
      });

      const updatedCase = MockData.getDxtrCase({
        override: {
          caseId: '081-24-12345',
          dateFiled: '2024-01-01', // Changed
          chapter: '11', // Changed
          courtDivisionCode: 'DIV002', // Changed
          closedDate: '2024-06-01', // Now closed
          reopenedDate: undefined,
          debtor: { name: 'Test Debtor' },
          dxtrId: '12345',
          courtId: '001',
        } satisfies Partial<DxtrCase>,
      });

      const event = mockCaseSyncEvent({ caseId: '081-24-12345' });

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(
        updatedCase as unknown as CaseDetail,
      );
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(originalCase);
      vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();
      const updateCaseFieldsSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateCaseFields')
        .mockResolvedValue();

      await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(updateCaseFieldsSpy).toHaveBeenCalledWith('081-24-12345', {
        dateFiled: '2024-01-01',
        chapter: '11',
        courtDivisionCode: 'DIV002',
        caseStatus: 'CLOSED',
      });
    });

    test('should skip updateCaseFields when no relevant fields changed', async () => {
      const caseData = MockData.getDxtrCase({
        override: {
          caseId: '081-24-12345',
          dateFiled: '2023-01-01',
          chapter: '7',
          courtDivisionCode: 'DIV001',
          closedDate: undefined,
          reopenedDate: undefined,
          debtor: { name: 'Test Debtor' },
          dxtrId: '12345',
          courtId: '001',
        } satisfies Partial<DxtrCase>,
      });

      const event = mockCaseSyncEvent({ caseId: '081-24-12345' });

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(
        caseData as unknown as CaseDetail,
      );
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(
        caseData as unknown as SyncedCase,
      );
      vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();
      const updateCaseFieldsSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateCaseFields')
        .mockResolvedValue();

      await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(updateCaseFieldsSpy).not.toHaveBeenCalled();
    });

    test('should retry updateCaseFields once on first failure', async () => {
      const caseData = MockData.getDxtrCase({
        override: {
          caseId: '081-24-12345',
          dateFiled: '2024-01-01', // Different from original
          chapter: '7',
          courtDivisionCode: 'DIV001',
          closedDate: undefined,
          reopenedDate: undefined,
          debtor: { name: 'Test Debtor' },
          dxtrId: '12345',
          courtId: '001',
        } satisfies Partial<DxtrCase>,
      });

      const originalCase = MockData.getDxtrCase({
        override: {
          caseId: '081-24-12345',
          dateFiled: '2023-01-01',
          chapter: '7',
          courtDivisionCode: 'DIV001',
          closedDate: undefined,
          reopenedDate: undefined,
          debtor: { name: 'Test Debtor' },
          dxtrId: '12345',
          courtId: '001',
        } satisfies Partial<DxtrCase>,
      });

      const event = mockCaseSyncEvent({ caseId: '081-24-12345' });

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(
        caseData as unknown as CaseDetail,
      );
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(
        originalCase as unknown as SyncedCase,
      );
      vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();
      const updateCaseFieldsSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateCaseFields')
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce();

      await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(updateCaseFieldsSpy).toHaveBeenCalledTimes(2);
    });

    test('should warn and continue on second updateCaseFields failure', async () => {
      const caseData = MockData.getDxtrCase({
        override: {
          caseId: '081-24-12345',
          dateFiled: '2024-01-01', // Different from original
          chapter: '7',
          courtDivisionCode: 'DIV001',
          closedDate: undefined,
          reopenedDate: undefined,
          debtor: { name: 'Test Debtor' },
          dxtrId: '12345',
          courtId: '001',
        } satisfies Partial<DxtrCase>,
      });

      const originalCase = MockData.getDxtrCase({
        override: {
          caseId: '081-24-12345',
          dateFiled: '2023-01-01',
          chapter: '7',
          courtDivisionCode: 'DIV001',
          closedDate: undefined,
          reopenedDate: undefined,
          debtor: { name: 'Test Debtor' },
          dxtrId: '12345',
          courtId: '001',
        } satisfies Partial<DxtrCase>,
      });

      const event = mockCaseSyncEvent({ caseId: '081-24-12345' });

      vi.spyOn(CasesLocalGateway.prototype, 'getCaseDetail').mockResolvedValue(
        caseData as unknown as CaseDetail,
      );
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(
        originalCase as unknown as SyncedCase,
      );
      vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'updateCaseFields').mockRejectedValue(
        new Error('Update failed'),
      );
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const [result] = await ExportAndLoadCase.exportAndLoad(context, [event]);

      expect(warnSpy).toHaveBeenCalledWith(
        'EXPORT-AND-LOAD',
        expect.stringContaining('updateCaseFields failed'),
        expect.any(Object),
      );
      // After both retries fail the error is surfaced on the event
      expect(result.error).toBeDefined();
    });
  });
});
