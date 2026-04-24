import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeUpcomingKeyDatesUseCase } from './trustee-upcoming-key-dates';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

function buildMockDocument(
  overrides: Partial<TrusteeUpcomingKeyDates> = {},
): TrusteeUpcomingKeyDates {
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
  overrides: Partial<TrusteeUpcomingKeyDatesInput> = {},
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    pastBackgroundQuestion: null,
    pastFieldExam: null,
    pastAudit: null,
    pastTprSubmission: null,
    tprReviewPeriodStart: null,
    tprReviewPeriodEnd: null,
    tprDue: null,
    tprDueYearType: null,
    tirReviewPeriodStart: null,
    tirReviewPeriodEnd: null,
    tirSubmission: null,
    tirReview: null,
    upcomingExamOrAuditYear: null,
    upcomingExamOrAuditType: null,
    tirFrequency: null,
    tirSemiAnnualReviewPeriodStart: null,
    tirSemiAnnualReviewPeriodEnd: null,
    tirSemiAnnualSubmission: null,
    tirSemiAnnualReview: null,
    lastAuditFiscalYear: null,
    ...overrides,
  };
}

describe('TrusteeUpcomingKeyDatesUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getUpcomingKeyDates returns document when found', async () => {
    const mockDoc = buildMockDocument();
    vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(mockDoc);

    const context = await createMockApplicationContext();
    const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
    const result = await useCase.getUpcomingKeyDates(mockDoc.appointmentId);

    expect(result).toEqual(mockDoc);
  });

  test('getUpcomingKeyDates returns null when no document exists', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);

    const context = await createMockApplicationContext();
    const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
    const result = await useCase.getUpcomingKeyDates('appointment-not-found');

    expect(result).toBeNull();
  });

  describe('upsertUpcomingKeyDates', () => {
    test('new appointment: creates history with all new fields', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: '2026-06-15' });

      await useCase.upsertUpcomingKeyDates(
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
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: '2026-06-15' });

      await useCase.upsertUpcomingKeyDates(
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
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: '2026-06-15' });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(createHistorySpy).not.toHaveBeenCalled();
    });

    test('saves lastAuditFiscalYear when set', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      vi.spyOn(MockMongoRepository.prototype, 'createHistory').mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ lastAuditFiscalYear: 2024 });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastAuditFiscalYear: 2024 }),
      );
    });

    test('does not include lastAuditFiscalYear in saved doc when null', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      vi.spyOn(MockMongoRepository.prototype, 'createHistory').mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ lastAuditFiscalYear: null });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      const savedDoc = upsertSpy.mock.calls[0][0];
      expect(savedDoc).not.toHaveProperty('lastAuditFiscalYear');
    });

    test('lastAuditFiscalYear change is captured in audit history', async () => {
      const existing = buildMockDocument({ lastAuditFiscalYear: 2022 });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ lastAuditFiscalYear: 2024 });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          before: { lastAuditFiscalYear: 2022 },
          after: { lastAuditFiscalYear: 2024 },
        }),
      );
    });

    test('saves upcomingExamOrAuditYear when set', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      vi.spyOn(MockMongoRepository.prototype, 'createHistory').mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ upcomingExamOrAuditYear: 2029 });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ upcomingExamOrAuditYear: 2029 }),
      );
    });

    test('saves upcomingExamOrAuditType when set', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      vi.spyOn(MockMongoRepository.prototype, 'createHistory').mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ upcomingExamOrAuditType: 'Field Exam' });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ upcomingExamOrAuditType: 'Field Exam' }),
      );
    });

    test('does not include upcomingExamOrAuditYear in saved doc when null', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      vi.spyOn(MockMongoRepository.prototype, 'createHistory').mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ upcomingExamOrAuditYear: null });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      const savedDoc = upsertSpy.mock.calls[0][0];
      expect(savedDoc).not.toHaveProperty('upcomingExamOrAuditYear');
    });

    test('upcomingExamOrAuditYear change is captured in audit history', async () => {
      const existing = buildMockDocument({ upcomingExamOrAuditYear: 2027 });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ upcomingExamOrAuditYear: 2029 });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          before: { upcomingExamOrAuditYear: 2027 },
          after: { upcomingExamOrAuditYear: 2029 },
        }),
      );
    });

    test('existing doc, field cleared (set to null): creates history showing old value → absent', async () => {
      const existing = buildMockDocument({ pastFieldExam: '2026-06-15' });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ pastFieldExam: null });

      await useCase.upsertUpcomingKeyDates(
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
