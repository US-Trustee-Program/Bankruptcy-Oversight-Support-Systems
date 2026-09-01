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
    lastMonthlyReportReceived: null,
    leaseExpiration: null,
    idExpiration: null,
    lastCompensationStudy: null,
    ...overrides,
  };
}

describe('TrusteeUpcomingKeyDatesUseCase', () => {
  beforeEach(() => {
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

    test('existing doc, one field changed: reuses existing id and creates history with only changed field', async () => {
      const existing = buildMockDocument({ pastFieldExam: '2026-01-15' });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
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

      const savedDoc = upsertSpy.mock.calls[0][0];
      expect(savedDoc.id).toBe(existing.id);
      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          before: { pastFieldExam: '2026-01-15' },
          after: { pastFieldExam: '2026-06-15' },
        }),
      );
    });

    test('new doc: saves lastMonthlyReportReceived and creates history without any ad hoc use-case handling', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ lastMonthlyReportReceived: '2024-11-15' });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastMonthlyReportReceived: '2024-11-15' }),
      );
      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_UPCOMING_REPORT_DATES',
          after: expect.objectContaining({ lastMonthlyReportReceived: '2024-11-15' }),
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

    test.each([
      ['lastAuditFiscalYear', 2024],
      ['upcomingExamOrAuditYear', 2029],
      ['upcomingExamOrAuditType', 'Field Exam'],
      ['leaseExpiration', '2027-06-30'],
      ['idExpiration', '2028-01-15'],
      ['lastCompensationStudy', '2024-06-01'],
    ])('saves %s when set', async (field, value) => {
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);
      vi.spyOn(MockMongoRepository.prototype, 'createHistory').mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ [field]: value });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ [field]: value }));
    });

    test.each([['lastAuditFiscalYear'], ['upcomingExamOrAuditYear'], ['upcomingExamOrAuditType']])(
      'does not include %s in saved doc when null',
      async (field) => {
        vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(null);
        const upsertSpy = vi
          .spyOn(MockMongoRepository.prototype, 'upsert')
          .mockResolvedValue(undefined);
        vi.spyOn(MockMongoRepository.prototype, 'createHistory').mockResolvedValue(undefined);

        const context = await createMockApplicationContext();
        const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
        const input = buildMockInput({ [field]: null });

        await useCase.upsertUpcomingKeyDates(
          'trustee-001',
          'appointment-001',
          input,
          SYSTEM_USER_REFERENCE,
        );

        const savedDoc = upsertSpy.mock.calls[0][0];
        expect(savedDoc).not.toHaveProperty(field);
      },
    );

    test.each([
      ['lastAuditFiscalYear', 2022, 2024],
      ['upcomingExamOrAuditYear', 2027, 2029],
      ['leaseExpiration', '2026-06-30', '2027-06-30'],
      ['idExpiration', '2027-01-15', '2028-01-15'],
      ['lastCompensationStudy', '2023-06-01', '2024-06-01'],
    ])('%s change is captured in audit history', async (field, before, after) => {
      const existing = buildMockDocument({ [field]: before });
      vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createHistory')
        .mockResolvedValue(undefined);

      const context = await createMockApplicationContext();
      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
      const input = buildMockInput({ [field]: after });

      await useCase.upsertUpcomingKeyDates(
        'trustee-001',
        'appointment-001',
        input,
        SYSTEM_USER_REFERENCE,
      );

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          before: { [field]: before },
          after: { [field]: after },
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

    test.each([
      ['lastAuditFiscalYear', { lastAuditFiscalYear: 2022 }, { lastAuditFiscalYear: null }],
      [
        'upcomingExamOrAuditYear',
        { upcomingExamOrAuditYear: 2027 },
        { upcomingExamOrAuditYear: null },
      ],
      [
        'upcomingExamOrAuditType',
        { upcomingExamOrAuditType: 'Field Exam' as const },
        { upcomingExamOrAuditType: null },
      ],
      ['leaseExpiration', { leaseExpiration: '2027-06-30' }, { leaseExpiration: null }],
      ['idExpiration', { idExpiration: '2028-01-15' }, { idExpiration: null }],
      [
        'lastCompensationStudy',
        { lastCompensationStudy: '2024-06-01' },
        { lastCompensationStudy: null },
      ],
    ])(
      'scalar field cleared (%s → null): history shows old value in before, absent from after',
      async (_field, existingOverride, inputOverride) => {
        const existing = buildMockDocument(existingOverride);
        vi.spyOn(MockMongoRepository.prototype, 'getByAppointmentId').mockResolvedValue(existing);
        vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(undefined);
        const createHistorySpy = vi
          .spyOn(MockMongoRepository.prototype, 'createHistory')
          .mockResolvedValue(undefined);

        const context = await createMockApplicationContext();
        const useCase = new TrusteeUpcomingKeyDatesUseCase(context);
        const input = buildMockInput(inputOverride);

        await useCase.upsertUpcomingKeyDates(
          'trustee-001',
          'appointment-001',
          input,
          SYSTEM_USER_REFERENCE,
        );

        expect(createHistorySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            before: existingOverride,
            after: {},
          }),
        );
      },
    );
  });
});
