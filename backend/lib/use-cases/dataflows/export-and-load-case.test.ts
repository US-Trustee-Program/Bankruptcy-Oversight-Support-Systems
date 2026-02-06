import { vi } from 'vitest';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import MockData from '@common/cams/test-utilities/mock-data';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { getCamsError } from '../../common-errors/error-utilities';
import { UnknownError } from '../../common-errors/unknown-error';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import ExportAndLoadCase from './export-and-load-case';

function mockCaseSyncEvent(override: Partial<CaseSyncEvent> = {}): CaseSyncEvent {
  return {
    type: 'CASE_CHANGED',
    caseId: '000-00-00000',
    ...override,
  };
}

describe('Export and Load Case Tests', () => {
  let context;

  beforeAll(async () => {
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
});
