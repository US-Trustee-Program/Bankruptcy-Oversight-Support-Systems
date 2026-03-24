import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeUpcomingReportDatesUseCase } from './trustee-upcoming-report-dates';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  TrusteeUpcomingReportDates,
  TrusteeUpcomingReportDatesInput,
} from '@common/cams/trustee-upcoming-report-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

function buildMockDocument(
  overrides: Partial<TrusteeUpcomingReportDates> = {},
): TrusteeUpcomingReportDates {
  return {
    id: 'test-id-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildMockInput(
  overrides: Partial<TrusteeUpcomingReportDatesInput> = {},
): TrusteeUpcomingReportDatesInput {
  return {
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    pastFieldExam: null,
    pastAudit: null,
    tprReviewPeriodStart: null,
    tprReviewPeriodEnd: null,
    tprDue: null,
    tprDueYearType: null,
    tirReviewPeriodStart: null,
    tirReviewPeriodEnd: null,
    tirSubmission: null,
    tirReview: null,
    upcomingFieldExam: null,
    upcomingIndependentAuditRequired: null,
    ...overrides,
  };
}

describe('TrusteeUpcomingReportDatesUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getUpcomingReportDates returns document when found', async () => {
    const mockDoc = buildMockDocument();
    vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(mockDoc);

    const context = await createMockApplicationContext();
    const useCase = new TrusteeUpcomingReportDatesUseCase(context);
    const result = await useCase.getUpcomingReportDates(mockDoc.appointmentId);

    expect(result).toEqual(mockDoc);
  });

  test('getUpcomingReportDates returns null when no document exists', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);

    const context = await createMockApplicationContext();
    const useCase = new TrusteeUpcomingReportDatesUseCase(context);
    const result = await useCase.getUpcomingReportDates('appointment-not-found');

    expect(result).toBeNull();
  });

  describe('upsertUpcomingReportDates', () => {
    test('new appointment: creates history with all new fields', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingReportDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: '2026-06-15' });

      await useCase.upsertUpcomingReportDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ pastFieldExam: '2026-06-15' }),
      );
      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_UPCOMING_REPORT_DATES',
          after: expect.objectContaining({ pastFieldExam: '2026-06-15' }),
        }),
      );
    });

    test('existing doc, one field changed: creates history with only changed field', async () => {
      const existing = buildMockDocument({ pastFieldExam: '2026-01-15' });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingReportDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: '2026-06-15' });

      await useCase.upsertUpcomingReportDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          before: { pastFieldExam: '2026-01-15' },
          after: { pastFieldExam: '2026-06-15' },
        }),
      );
    });

    test('existing doc, no fields changed: does not create history', async () => {
      const existing = buildMockDocument({ pastFieldExam: '2026-06-15' });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingReportDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: '2026-06-15' });

      await useCase.upsertUpcomingReportDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(createHistorySpy).not.toHaveBeenCalled();
    });

    test('existing doc, field cleared (set to null): creates history showing old value → absent', async () => {
      const existing = buildMockDocument({ pastFieldExam: '2026-06-15' });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingReportDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: null });

      await useCase.upsertUpcomingReportDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          before: { pastFieldExam: '2026-06-15' },
          after: {},
        }),
      );
    });
  });
});
