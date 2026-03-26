import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeDueDateMetricsUseCase } from './trustee-due-date-metrics';
import factory from '../../factory';
import {
  TrusteeAppointmentsRepository,
  TrusteeUpcomingKeyDatesRepository,
} from '../gateways.types';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';

function makeAppointment(id: string): TrusteeAppointment {
  return MockData.getTrusteeAppointment({ id, chapter: '7' });
}

function makeKeyDates(
  appointmentId: string,
  overrides: Partial<TrusteeUpcomingKeyDates> = {},
): TrusteeUpcomingKeyDates {
  return {
    id: `kd-${appointmentId}`,
    appointmentId,
    trusteeId: 'trustee-1',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    createdBy: { id: 'user-1', name: 'User One' },
    updatedBy: { id: 'user-1', name: 'User One' },
    ...overrides,
  };
}

const ALL_FIELDS: Partial<TrusteeUpcomingKeyDates> = {
  tprReviewPeriodStart: '1900-01-01',
  tprReviewPeriodEnd: '1900-03-31',
  pastFieldExam: '2024-06-15',
  pastAudit: '2024-03-10',
  tprDue: '1900-04-15',
  tirReviewPeriodStart: '1900-05-01',
  tirReviewPeriodEnd: '1900-07-31',
  tirSubmission: '1900-08-30',
  tirReview: '1900-10-29',
  upcomingFieldExam: '2026-06-30',
  upcomingIndependentAuditRequired: '2027-03-31',
};

describe('TrusteeDueDateMetricsUseCase', () => {
  let context: ApplicationContext;
  let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;
  let mockKeyDatesRepo: Partial<TrusteeUpcomingKeyDatesRepository>;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockAppointmentsRepo = {
      listAllChapter7Appointments: vi.fn().mockResolvedValue([]),
      release: vi.fn(),
    };
    mockKeyDatesRepo = {
      listAll: vi.fn().mockResolvedValue([]),
      release: vi.fn(),
    };

    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      mockAppointmentsRepo as TrusteeAppointmentsRepository,
    );
    vi.spyOn(factory, 'getTrusteeUpcomingKeyDatesRepository').mockReturnValue(
      mockKeyDatesRepo as TrusteeUpcomingKeyDatesRepository,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return all zeros when no appointments exist', async () => {
    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.totalChapter7Appointments).toBe(0);
    expect(metrics.completeCount).toBe(0);
    expect(metrics.partialCount).toBe(0);
    expect(metrics.noneCount).toBe(0);
    expect(metrics.completePercent).toBe(0);
    expect(metrics.partialPercent).toBe(0);
    expect(metrics.nonePercent).toBe(0);
    expect(metrics.tprReviewPeriodPercent).toBe(0);
    expect(metrics.pastFieldExamPercent).toBe(0);
    expect(metrics.pastIndependentAuditPercent).toBe(0);
    expect(metrics.tirReviewPeriodPercent).toBe(0);
    expect(metrics.tprDueDatePercent).toBe(0);
    expect(metrics.upcomingFieldExamPercent).toBe(0);
    expect(metrics.upcomingIndependentAuditRequiredPercent).toBe(0);
    expect(metrics.tirSubmissionPercent).toBe(0);
    expect(metrics.tirReviewDueDatePercent).toBe(0);
  });

  test('should classify appointment with no key dates doc as None', async () => {
    vi.mocked(mockAppointmentsRepo.listAllChapter7Appointments).mockResolvedValue([
      makeAppointment('appt-1'),
    ]);

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.totalChapter7Appointments).toBe(1);
    expect(metrics.noneCount).toBe(1);
    expect(metrics.completeCount).toBe(0);
    expect(metrics.partialCount).toBe(0);
    expect(metrics.nonePercent).toBe(100);
  });

  test('should classify appointment with all 9 fields as Complete', async () => {
    vi.mocked(mockAppointmentsRepo.listAllChapter7Appointments).mockResolvedValue([
      makeAppointment('appt-1'),
    ]);
    vi.mocked(mockKeyDatesRepo.listAll).mockResolvedValue([makeKeyDates('appt-1', ALL_FIELDS)]);

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.completeCount).toBe(1);
    expect(metrics.partialCount).toBe(0);
    expect(metrics.noneCount).toBe(0);
    expect(metrics.completePercent).toBe(100);
  });

  test('should classify appointment with some fields as Partial', async () => {
    vi.mocked(mockAppointmentsRepo.listAllChapter7Appointments).mockResolvedValue([
      makeAppointment('appt-1'),
    ]);
    vi.mocked(mockKeyDatesRepo.listAll).mockResolvedValue([
      makeKeyDates('appt-1', { pastFieldExam: '2024-06-15', tprDue: '1900-04-15' }),
    ]);

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.partialCount).toBe(1);
    expect(metrics.completeCount).toBe(0);
    expect(metrics.noneCount).toBe(0);
  });

  test('should classify appointment with doc but all fields empty as None', async () => {
    vi.mocked(mockAppointmentsRepo.listAllChapter7Appointments).mockResolvedValue([
      makeAppointment('appt-1'),
    ]);
    vi.mocked(mockKeyDatesRepo.listAll).mockResolvedValue([makeKeyDates('appt-1')]);

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.noneCount).toBe(1);
    expect(metrics.completeCount).toBe(0);
    expect(metrics.partialCount).toBe(0);
  });

  test('tprReviewPeriod requires BOTH start AND end to count', async () => {
    vi.mocked(mockAppointmentsRepo.listAllChapter7Appointments).mockResolvedValue([
      makeAppointment('appt-1'),
      makeAppointment('appt-2'),
      makeAppointment('appt-3'),
    ]);
    vi.mocked(mockKeyDatesRepo.listAll).mockResolvedValue([
      makeKeyDates('appt-1', { tprReviewPeriodStart: '1900-01-01' }), // only start → not counted
      makeKeyDates('appt-2', { tprReviewPeriodEnd: '1900-03-31' }), // only end → not counted
      makeKeyDates('appt-3', {
        tprReviewPeriodStart: '1900-01-01',
        tprReviewPeriodEnd: '1900-03-31',
      }), // both → counted
    ]);

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.tprReviewPeriodPercent).toBe(33);
  });

  test('tirReviewPeriod requires BOTH start AND end to count', async () => {
    vi.mocked(mockAppointmentsRepo.listAllChapter7Appointments).mockResolvedValue([
      makeAppointment('appt-1'),
      makeAppointment('appt-2'),
    ]);
    vi.mocked(mockKeyDatesRepo.listAll).mockResolvedValue([
      makeKeyDates('appt-1', { tirReviewPeriodStart: '1900-05-01' }), // only start → not counted
      makeKeyDates('appt-2', {
        tirReviewPeriodStart: '1900-05-01',
        tirReviewPeriodEnd: '1900-07-31',
      }),
    ]);

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.tirReviewPeriodPercent).toBe(50);
  });

  test('should compute correct per-field percents across mixed appointments', async () => {
    vi.mocked(mockAppointmentsRepo.listAllChapter7Appointments).mockResolvedValue([
      makeAppointment('appt-1'),
      makeAppointment('appt-2'),
      makeAppointment('appt-3'),
      makeAppointment('appt-4'),
    ]);
    vi.mocked(mockKeyDatesRepo.listAll).mockResolvedValue([
      makeKeyDates('appt-1', ALL_FIELDS),
      makeKeyDates('appt-2', ALL_FIELDS),
      makeKeyDates('appt-3', { pastFieldExam: '2024-06-15' }),
      // appt-4 has no doc → None
    ]);

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.totalChapter7Appointments).toBe(4);
    expect(metrics.completeCount).toBe(2);
    expect(metrics.partialCount).toBe(1);
    expect(metrics.noneCount).toBe(1);
    expect(metrics.completePercent).toBe(50);
    expect(metrics.partialPercent).toBe(25);
    expect(metrics.nonePercent).toBe(25);
    // pastFieldExam present in appt-1, appt-2, appt-3 → 3/4 = 75%
    expect(metrics.pastFieldExamPercent).toBe(75);
    // tprReviewPeriod present in appt-1 and appt-2 → 2/4 = 50%
    expect(metrics.tprReviewPeriodPercent).toBe(50);
  });

  test('should release both repositories after use', async () => {
    await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(mockAppointmentsRepo.release).toHaveBeenCalledTimes(1);
    expect(mockKeyDatesRepo.release).toHaveBeenCalledTimes(1);
  });
});
