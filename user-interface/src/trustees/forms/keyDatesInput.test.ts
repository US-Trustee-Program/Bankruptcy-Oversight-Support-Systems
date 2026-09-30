import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mergeKeyDatesInput, buildYearOptions, getFiscalYearOptions } from './keyDatesInput';
import { buildBondKeyDatesInput } from './BondKeyDatesForm';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('buildYearOptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('builds a forward range starting at the current year', () => {
    expect(buildYearOptions('forward', 11)).toEqual([
      2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036,
    ]);
  });

  test('builds a backward range starting at the current year', () => {
    expect(buildYearOptions('backward', 11)).toEqual([
      2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016,
    ]);
  });

  test('honors an arbitrary span', () => {
    expect(buildYearOptions('backward', 21)).toHaveLength(21);
    expect(buildYearOptions('backward', 21)[20]).toBe(2006);
  });
});

describe('getFiscalYearOptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('is a 21-year backward range starting at the current year', () => {
    expect(getFiscalYearOptions()).toEqual(buildYearOptions('backward', 21));
    expect(getFiscalYearOptions()[0]).toBe(2026);
    expect(getFiscalYearOptions()).toHaveLength(21);
  });
});

const ids = { trusteeId: 'trustee-001', appointmentId: 'appointment-001' };

const fullOriginal: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  pastBackgroundQuestion: '2020-01-01',
  pastFieldExam: '2020-01-02',
  pastAudit: '2020-01-03',
  pastTprSubmission: '2020-01-04',
  lastTprSubmitted: '2020-01-05',
  tprReviewPeriodStart: '2020-01-06',
  tprReviewPeriodEnd: '2020-01-07',
  tprDue: '1900-10-06',
  tprDueYearType: 'EVEN',
  tprFrequency: 'ANNUAL',
  tirReviewPeriodStart: '2020-01-08',
  tirReviewPeriodEnd: '2020-01-09',
  tirSubmission: '2020-01-10',
  tirReview: '2020-01-11',
  upcomingExamOrAuditYear: 2024,
  upcomingExamOrAuditType: 'Field Exam',
  tirFrequency: 'SEMI_ANNUAL',
  tirSemiAnnualReviewPeriodStart: '2020-01-12',
  tirSemiAnnualReviewPeriodEnd: '2020-01-13',
  tirSemiAnnualSubmission: '2020-01-14',
  tirSemiAnnualReview: '2020-01-15',
  lastAuditFiscalYear: 2021,
  auditCompletionYear: 2021,
  auditCompletionStatus: 'NOT_CLOSED',
  tprCompletionYear: 2022,
  tprCompletionStatus: 'INCOMPLETE',
  tirCompletionYear: 2023,
  tirCompletionStatus: 'COMPLETE',
  lastMonthlyReportReceived: '2020-01-16',
  leaseExpiration: '2020-01-17',
  idExpiration: '2020-01-18',
  lastCompensationStudy: '2020-01-19',
  bondIssuedDate: '2020-01-20',
  bondRenewalDate: '2020-01-21',
  ch13AuditCompletionYear: 2025,
  ch13AuditCompletionStatus: 'COMPLETE',
};

describe('mergeKeyDatesInput', () => {
  test('carries all fields forward from original when no overrides are provided', () => {
    const result = mergeKeyDatesInput(ids, fullOriginal, {});

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: '2020-01-01',
      pastFieldExam: '2020-01-02',
      pastAudit: '2020-01-03',
      pastTprSubmission: '2020-01-04',
      lastTprSubmitted: '2020-01-05',
      tprReviewPeriodStart: '2020-01-06',
      tprReviewPeriodEnd: '2020-01-07',
      tprDue: '1900-10-06',
      tprDueYearType: 'EVEN',
      tprFrequency: 'ANNUAL',
      tirReviewPeriodStart: '2020-01-08',
      tirReviewPeriodEnd: '2020-01-09',
      tirSubmission: '2020-01-10',
      tirReview: '2020-01-11',
      upcomingExamOrAuditYear: 2024,
      upcomingExamOrAuditType: 'Field Exam',
      tirFrequency: 'SEMI_ANNUAL',
      tirSemiAnnualReviewPeriodStart: '2020-01-12',
      tirSemiAnnualReviewPeriodEnd: '2020-01-13',
      tirSemiAnnualSubmission: '2020-01-14',
      tirSemiAnnualReview: '2020-01-15',
      lastAuditFiscalYear: 2021,
      auditCompletionYear: 2021,
      auditCompletionStatus: 'NOT_CLOSED',
      tprCompletionYear: 2022,
      tprCompletionStatus: 'INCOMPLETE',
      tirCompletionYear: 2023,
      tirCompletionStatus: 'COMPLETE',
      lastMonthlyReportReceived: '2020-01-16',
      leaseExpiration: '2020-01-17',
      idExpiration: '2020-01-18',
      lastCompensationStudy: '2020-01-19',
      bondIssuedDate: '2020-01-20',
      bondRenewalDate: '2020-01-21',
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: 2025,
      ch13AuditCompletionStatus: 'COMPLETE',
    });
  });

  test('overrides replace original values for the specified fields only', () => {
    const result = mergeKeyDatesInput(ids, fullOriginal, {
      pastFieldExam: '2026-05-01',
      pastAudit: null,
    });

    expect(result.pastFieldExam).toBe('2026-05-01');
    expect(result.pastAudit).toBeNull();
    expect(result.pastBackgroundQuestion).toBe('2020-01-01');
    expect(result.tprFrequency).toBe('ANNUAL');
  });

  test('defaults every field to null when original is null', () => {
    const result = mergeKeyDatesInput(ids, null, {});

    expect(result.trusteeId).toBe('trustee-001');
    expect(result.appointmentId).toBe('appointment-001');
    expect(result.pastBackgroundQuestion).toBeNull();
    expect(result.tprFrequency).toBeNull();
    expect(result.bondRenewalDate).toBeNull();
  });

  test('overrides apply even when original is null', () => {
    const result = mergeKeyDatesInput(ids, null, {
      pastBackgroundQuestion: '2026-01-01',
      tprFrequency: 'SEMI_ANNUAL',
    });

    expect(result.pastBackgroundQuestion).toBe('2026-01-01');
    expect(result.tprFrequency).toBe('SEMI_ANNUAL');
    expect(result.pastFieldExam).toBeNull();
  });
});

describe('buildBondKeyDatesInput', () => {
  const fullOriginal: TrusteeUpcomingKeyDates = {
    id: 'doc-full',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    pastBackgroundQuestion: 'past-background-question',
    pastFieldExam: '2020-01-01',
    pastAudit: '2020-01-02',
    pastTprSubmission: '2020-01-03',
    lastTprSubmitted: '2020-01-22',
    tprReviewPeriodStart: '2020-01-04',
    tprReviewPeriodEnd: '2020-01-05',
    tprDue: '2020-01-06',
    tprDueYearType: 'EVEN',
    tprFrequency: 'ANNUAL',
    tirReviewPeriodStart: '2020-01-07',
    tirReviewPeriodEnd: '2020-01-08',
    tirSubmission: '2020-01-09',
    tirReview: '2020-01-10',
    upcomingExamOrAuditYear: 2025,
    upcomingExamOrAuditType: 'Audit',
    tirFrequency: 'SEMI_ANNUAL',
    tirSemiAnnualReviewPeriodStart: '2020-01-11',
    tirSemiAnnualReviewPeriodEnd: '2020-01-12',
    tirSemiAnnualSubmission: '2020-01-13',
    tirSemiAnnualReview: '2020-01-14',
    lastAuditFiscalYear: 2024,
    auditCompletionYear: 2024,
    auditCompletionStatus: 'CLOSED',
    tprCompletionYear: 2024,
    tprCompletionStatus: 'COMPLETE',
    tirCompletionYear: 2023,
    tirCompletionStatus: 'INCOMPLETE',
    lastMonthlyReportReceived: '2020-01-15',
    leaseExpiration: '2020-01-16',
    idExpiration: '2020-01-17',
    lastCompensationStudy: '2020-01-18',
    bondIssuedDate: '2020-01-19',
    bondRenewalDate: '2020-01-20',
    annualReportCompletionYear: 2025,
    annualReportCompletionStatus: 'INCOMPLETE' as const,
  };

  test('preserves every non-bond field from the original document and overrides only the bond dates', () => {
    const result = buildBondKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      fullOriginal,
      { bondIssuedDate: '2023-06-01', bondRenewalDate: '2026-06-01' },
    );

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: 'past-background-question',
      pastFieldExam: '2020-01-01',
      pastAudit: '2020-01-02',
      pastTprSubmission: '2020-01-03',
      lastTprSubmitted: '2020-01-22',
      tprReviewPeriodStart: '2020-01-04',
      tprReviewPeriodEnd: '2020-01-05',
      tprDue: '2020-01-06',
      tprDueYearType: 'EVEN',
      tprFrequency: 'ANNUAL',
      tirReviewPeriodStart: '2020-01-07',
      tirReviewPeriodEnd: '2020-01-08',
      tirSubmission: '2020-01-09',
      tirReview: '2020-01-10',
      upcomingExamOrAuditYear: 2025,
      upcomingExamOrAuditType: 'Audit',
      tirFrequency: 'SEMI_ANNUAL',
      tirSemiAnnualReviewPeriodStart: '2020-01-11',
      tirSemiAnnualReviewPeriodEnd: '2020-01-12',
      tirSemiAnnualSubmission: '2020-01-13',
      tirSemiAnnualReview: '2020-01-14',
      lastAuditFiscalYear: 2024,
      auditCompletionYear: 2024,
      auditCompletionStatus: 'CLOSED',
      tprCompletionYear: 2024,
      tprCompletionStatus: 'COMPLETE',
      tirCompletionYear: 2023,
      tirCompletionStatus: 'INCOMPLETE',
      lastMonthlyReportReceived: '2020-01-15',
      leaseExpiration: '2020-01-16',
      idExpiration: '2020-01-17',
      lastCompensationStudy: '2020-01-18',
      bondIssuedDate: '2023-06-01',
      bondRenewalDate: '2026-06-01',
      annualReportCompletionYear: 2025,
      annualReportCompletionStatus: 'INCOMPLETE',
      ch13AuditCompletionYear: null,
      ch13AuditCompletionStatus: null,
    });
  });

  test('defaults every field to null when there is no original document and the form is empty', () => {
    const result = buildBondKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      null,
      { bondIssuedDate: '', bondRenewalDate: '' },
    );

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: null,
      pastFieldExam: null,
      pastAudit: null,
      pastTprSubmission: null,
      lastTprSubmitted: null,
      tprReviewPeriodStart: null,
      tprReviewPeriodEnd: null,
      tprDue: null,
      tprDueYearType: null,
      tprFrequency: null,
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
      auditCompletionYear: null,
      auditCompletionStatus: null,
      tprCompletionYear: null,
      tprCompletionStatus: null,
      tirCompletionYear: null,
      tirCompletionStatus: null,
      lastMonthlyReportReceived: null,
      leaseExpiration: null,
      idExpiration: null,
      lastCompensationStudy: null,
      bondIssuedDate: null,
      bondRenewalDate: null,
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: null,
      ch13AuditCompletionStatus: null,
    });
  });

  test('applies bondIssuedDate and bondRenewalDate independently rather than as an all-or-nothing pair', () => {
    const result = buildBondKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      fullOriginal,
      { bondIssuedDate: '2023-06-01', bondRenewalDate: '' },
    );

    expect(result.bondIssuedDate).toBe('2023-06-01');
    expect(result.bondRenewalDate).toBeNull();
    // Every other field should still be carried forward from the original, unaffected.
    expect(result.pastFieldExam).toBe(fullOriginal.pastFieldExam);
  });
});
