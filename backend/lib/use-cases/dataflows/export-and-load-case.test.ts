import { vi } from 'vitest';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { SyncedCase } from '@common/cams/cases';
import MockData from '@common/cams/test-utilities/mock-data';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { getCamsError } from '../../common-errors/error-utilities';
import { UnknownError } from '../../common-errors/unknown-error';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
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
      const expected: SyncedCase = {
        ...bCase,
        documentType: 'SYNCED_CASE',
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: expect.any(String),
        createdBy: SYSTEM_USER_REFERENCE,
        createdOn: expect.any(String),
        debtor: {
          ...bCase.debtor,
          phoneticTokens: expect.any(Array),
        },
      };

      const syncSpy = vi.spyOn(MockMongoRepository.prototype, 'syncDxtrCase').mockResolvedValue();

      await ExportAndLoadCase.loadCase(context, event);
      expect(syncSpy).toHaveBeenCalledWith(expected);
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
  });
});
