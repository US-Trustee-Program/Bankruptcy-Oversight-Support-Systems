/**
 * Scenario: trustee-key-dates
 * Database: cams only
 *
 * Seeds trustee key dates to exercise upcoming/past key date features:
 *
 *   - Ch7 trustees: TIR Review Period dates with auto-calculated submission/review,
 *     past Field Exam and Audit dates, calculated next exam/audit dates with quarter
 *     alignment, and a mix of quarter-boundary and mid-quarter dates
 *   - Two Chapter 11 Subchapter V (Pool) trustees to exercise the Last Monthly Report
 *     Received past key date: one populated, one empty
 *   - Two Chapter 12/13 Case by Case trustees to exercise the Upcoming Key Dates
 *     card's TPR Period/Due fields: one populated, one empty
 *   - Two Chapter 7 Elected trustees to exercise the Bond Issued Date (Past) /
 *     Bond Renewal Date (Upcoming) fields: one populated, one empty
 *   - One Chapter 7 Elected trustee with an inactive appointment to exercise the
 *     accordion's default-collapsed/inactive-status-tag behavior
 *
 * NOTE: Key dates are separate documents with documentType='TRUSTEE_UPCOMING_REPORT_DATES'.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { createTrusteeBase } from '../lib/test-data-utils.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

// Helper to calculate TIR submission (review period end + 30 days)
function addDaysToSentinel(sentinel: string, days: number): string {
  const [, month, day] = sentinel.split('-').map(Number);
  const date = new Date(2000, month - 1, day);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `1900-${mm}-${dd}`;
}

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: Ch7 Trustee for key dates testing ────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-001',
            firstName: 'Marcus',
            lastName: 'Keydates',
            status: 'active',
            address1: '100 Key Dates Lane',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            phone: '212-555-0800',
            email: 'marcus.keydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Ch7 appointment for Marcus ───────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-001',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Key dates with quarter-boundary TIR dates ────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-001',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-001',
          appointmentId: 'seed-appointment-keydates-001',
          // TIR dates (quarter boundary: 3/31)
          tirReviewPeriodStart: '1900-01-01',
          tirReviewPeriodEnd: '1900-03-31',
          tirSubmission: addDaysToSentinel('1900-03-31', 30), // April 30
          tirReview: addDaysToSentinel(addDaysToSentinel('1900-03-31', 30), 60), // June 29
          // Past dates for Field Exam / Audit calculations
          pastFieldExam: '2022-06-15',
          pastAudit: '2020-09-30',
          // Calculated next exam (3 years from most recent, quarter-aligned)
          upcomingExamOrAuditYear: 2025,
          upcomingExamOrAuditType: 'Field Exam',
          // TPR dates, so the Chapter 7 Panel accordion's Trustee Performance
          // Report card has non-blank demo data alongside the fields above
          tprReviewPeriodStart: '1900-04-01',
          tprReviewPeriodEnd: '1900-09-30',
          tprFrequency: 'ANNUAL',
          tprDue: '1900-10-15',
          tprDueYearType: 'EVEN',
          lastTprSubmitted: '2024-10-11',
          pastBackgroundQuestion: '2023-06-03',
          // Completion status for the Audit/Field Exam card's tag (CAMS-912 Slice 2)
          auditCompletionYear: 2020,
          auditCompletionStatus: 'CLOSED',
          // Completion status for the Trustee Performance Report card's tag (CAMS-912 Slice 3)
          tprCompletionYear: 2024,
          tprCompletionStatus: 'COMPLETE',
          // Completion status for the Trustee Interim Report card's tag (CAMS-912 Slice 4)
          tirCompletionYear: 2024,
          tirCompletionStatus: 'COMPLETE',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Another Ch7 Trustee with mid-quarter dates ───────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-002',
            firstName: 'Diana',
            lastName: 'Keydates',
            status: 'active',
            address1: '200 Key Dates Blvd',
            city: 'New York',
            state: 'NY',
            zipCode: '10002',
            phone: '212-555-0900',
            email: 'diana.keydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-002',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-002',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2019-01-01',
          status: 'active',
          effectiveDate: '2019-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Key dates with mid-quarter TIR dates ─────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-002',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-002',
          appointmentId: 'seed-appointment-keydates-002',
          // TIR dates (mid-quarter: 2/15)
          tirReviewPeriodStart: '1900-01-01',
          tirReviewPeriodEnd: '1900-02-15',
          tirSubmission: addDaysToSentinel('1900-02-15', 30), // March 17
          tirReview: addDaysToSentinel(addDaysToSentinel('1900-02-15', 30), 60), // May 16
          // Past dates
          pastFieldExam: '2021-11-20',
          pastAudit: '2019-03-31',
          // Next audit (6 years from most recent)
          upcomingExamOrAuditYear: 2027,
          upcomingExamOrAuditType: 'Audit',
          lastAuditFiscalYear: 2024,
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Ch7 Trustee with year-boundary dates ─────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-003',
            firstName: 'Samuel',
            lastName: 'Keydates',
            status: 'active',
            address1: '300 Key Dates Ave',
            city: 'New York',
            state: 'NY',
            zipCode: '10003',
            phone: '212-555-1000',
            email: 'samuel.keydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-003',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-003',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2018-01-01',
          status: 'active',
          effectiveDate: '2018-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Key dates with year-boundary (12/31) ────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-003',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-003',
          appointmentId: 'seed-appointment-keydates-003',
          // TIR dates (year boundary: 12/31)
          tirReviewPeriodStart: '1900-10-01',
          tirReviewPeriodEnd: '1900-12-31',
          tirSubmission: addDaysToSentinel('1900-12-31', 30), // January 30
          tirReview: addDaysToSentinel(addDaysToSentinel('1900-12-31', 30), 60), // March 31
          // Past dates
          pastFieldExam: '2023-12-31',
          pastAudit: '2017-12-31',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Ch7 Trustee with empty key dates ─────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-empty',
            firstName: 'Emily',
            lastName: 'Nokeydates',
            status: 'active',
            address1: '400 Key Dates St',
            city: 'New York',
            state: 'NY',
            zipCode: '10004',
            phone: '212-555-1100',
            email: 'emily.nokeydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-empty',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-empty',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2021-01-01',
          status: 'active',
          effectiveDate: '2021-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Empty key dates document (for empty form testing) ────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-empty',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-empty',
          appointmentId: 'seed-appointment-keydates-empty',
          // All fields null/undefined - tests empty form state
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 11 Subchapter V (Pool) Trustee with a saved date ─────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-subv-001',
            firstName: 'Priya',
            lastName: 'Keydates',
            status: 'active',
            address1: '500 Key Dates Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10005',
            phone: '212-555-1200',
            email: 'priya.keydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-subv-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-subv-001',
          chapter: '11-subchapter-v',
          appointmentType: 'pool',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2023-01-01',
          status: 'active',
          effectiveDate: '2023-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-subv-001',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-subv-001',
          appointmentId: 'seed-appointment-keydates-subv-001',
          lastMonthlyReportReceived: '2024-11-15',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 11 Subchapter V (Pool) Trustee with no saved date ────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-subv-empty',
            firstName: 'Priya',
            lastName: 'Nokeydates',
            status: 'active',
            address1: '600 Key Dates Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10006',
            phone: '212-555-1300',
            email: 'priya.nokeydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-subv-empty',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-subv-empty',
          chapter: '11-subchapter-v',
          appointmentType: 'pool',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2023-01-01',
          status: 'active',
          effectiveDate: '2023-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-subv-empty',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-subv-empty',
          appointmentId: 'seed-appointment-keydates-subv-empty',
          // lastMonthlyReportReceived omitted - tests "No date added" / empty form state
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 12 Case by Case Trustee with saved TPR dates ─────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-ch12-cbc-001',
            firstName: 'Nadia',
            lastName: 'Keydates',
            status: 'active',
            address1: '700 Key Dates Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10007',
            phone: '212-555-1400',
            email: 'nadia.keydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-ch12-cbc-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-ch12-cbc-001',
          chapter: '12',
          appointmentType: 'case-by-case',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2023-01-01',
          status: 'active',
          effectiveDate: '2023-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-ch12-cbc-001',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-ch12-cbc-001',
          appointmentId: 'seed-appointment-keydates-ch12-cbc-001',
          tprReviewPeriodStart: '1900-04-01',
          tprReviewPeriodEnd: '1900-09-30',
          tprDue: '1900-10-15',
          tprDueYearType: 'EVEN',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 13 Case by Case Trustee with no saved date ───────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-ch13-cbc-empty',
            firstName: 'Nadia',
            lastName: 'Nokeydates',
            status: 'active',
            address1: '800 Key Dates Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10008',
            phone: '212-555-1500',
            email: 'nadia.nokeydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-ch13-cbc-empty',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-ch13-cbc-empty',
          chapter: '13',
          appointmentType: 'case-by-case',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2023-01-01',
          status: 'active',
          effectiveDate: '2023-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-ch13-cbc-empty',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-ch13-cbc-empty',
          appointmentId: 'seed-appointment-keydates-ch13-cbc-empty',
          // All optional fields omitted - tests "No date added" placeholder state
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 12 Standing Trustee with key dates ───────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-ch12-001',
            firstName: 'Catherine',
            lastName: 'Keydates',
            status: 'active',
            address1: '700 Standing Ave',
            city: 'New York',
            state: 'NY',
            zipCode: '10007',
            phone: '212-555-1400',
            email: 'catherine.keydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-ch12-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-ch12-001',
          chapter: '12',
          appointmentType: 'standing',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2021-03-15',
          status: 'active',
          effectiveDate: '2021-03-15',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-ch12-001',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-ch12-001',
          appointmentId: 'seed-appointment-keydates-ch12-001',
          // Past Key Dates (chapter12-standing variant)
          pastBackgroundQuestion: '2023-04-10',
          pastAudit: '2022-09-15',
          lastAuditFiscalYear: 2022, // Audit Req. By = 2025
          // Upcoming Key Dates (chapter12-standing variant)
          tprReviewPeriodStart: '1900-01-01',
          tprReviewPeriodEnd: '1900-12-31',
          tprDue: '1900-03-15',
          tprDueYearType: 'ODD',
          leaseExpiration: '2027-06-30',
          idExpiration: '2028-01-15',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 7 Elected Trustee with saved bond dates ──────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-elected-001',
            firstName: 'Owen',
            lastName: 'Keydates',
            status: 'active',
            address1: '900 Key Dates Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10009',
            phone: '212-555-1600',
            email: 'owen.keydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-elected-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-elected-001',
          chapter: '7',
          appointmentType: 'elected',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2023-01-01',
          status: 'active',
          effectiveDate: '2023-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-elected-001',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-elected-001',
          appointmentId: 'seed-appointment-keydates-elected-001',
          bondIssuedDate: '2023-06-01',
          bondRenewalDate: '2026-06-01',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 7 Elected Trustee with no saved bond dates ───────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-elected-empty',
            firstName: 'Owen',
            lastName: 'Nokeydates',
            status: 'active',
            address1: '1000 Key Dates Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10010',
            phone: '212-555-1700',
            email: 'owen.nokeydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-elected-empty',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-elected-empty',
          chapter: '7',
          appointmentType: 'elected',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2023-01-01',
          status: 'active',
          effectiveDate: '2023-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-elected-empty',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-elected-empty',
          appointmentId: 'seed-appointment-keydates-elected-empty',
          // bondIssuedDate/bondRenewalDate omitted - tests "No date added" / empty form state
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 13 Standing Trustee with fully populated key dates ──
    // Active appointment: all four accordion cards render real data, both
    // completion-status tags show (CAMS-915).
    // ── Cosmos: Chapter 7 Elected Trustee with an inactive appointment ───────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-ch13-standing-001',
            firstName: 'Felicia',
            lastName: 'Keydates',
            status: 'active',
            address1: '1300 Standing Blvd',
            city: 'New York',
            state: 'NY',
            zipCode: '10008',
            phone: '212-555-1800',
            email: 'felicia.keydates@example.com',
            id: 'seed-trustee-keydates-elected-inactive',
            firstName: 'Owen',
            lastName: 'Inactivekeydates',
            status: 'active',
            address1: '1100 Key Dates Way',
            city: 'New York',
            state: 'NY',
            zipCode: '10011',
            phone: '212-555-1800',
            email: 'owen.inactivekeydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-ch13-standing-001',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-ch13-standing-001',
          chapter: '13',
          appointmentType: 'standing',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2021-06-01',
          status: 'active',
          effectiveDate: '2021-06-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-ch13-standing-001',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-ch13-standing-001',
          appointmentId: 'seed-appointment-keydates-ch13-standing-001',
          // Audit card
          pastAudit: '2025-06-30',
          ch13AuditCompletionYear: 2025,
          ch13AuditCompletionStatus: 'Complete',
          // Trustee Performance Report card
          tprReviewPeriodStart: '2025-04-01',
          tprReviewPeriodEnd: '2025-09-30',
          tprFrequency: 'ANNUAL',
          tprDue: '1900-09-15',
          tprDueYearType: 'EVEN',
          pastTprSubmission: '2025-10-01',
          ch13TprCompletionYear: 2025,
          ch13TprCompletionStatus: 'Complete',
          // Budget card fields are fixed constants, no data needed
          // Other card
          leaseExpiration: '2027-06-30',
          pastBackgroundQuestion: '2025-01-15',
          idExpiration: '2028-01-15',
          lastCompensationStudy: '2024-06-01',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: Chapter 13 Standing Trustee, inactive appointment, no key dates ──
    // Exercises "No date added" defaults, the gray status tag, and the
    // accordion's default-closed behavior for a non-active appointment (CAMS-915).
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          ...createTrusteeBase({
            id: 'seed-trustee-keydates-ch13-standing-empty',
            firstName: 'Gregory',
            lastName: 'Nokeydates',
            status: 'active',
            address1: '1301 Standing Blvd',
            city: 'New York',
            state: 'NY',
            zipCode: '10008',
            phone: '212-555-1801',
            email: 'gregory.nokeydates@example.com',
          }),
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [
        {
          id: 'seed-appointment-keydates-ch13-standing-empty',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-ch13-standing-empty',
          chapter: '13',
          appointmentType: 'standing',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2019-01-01',
          id: 'seed-appointment-keydates-elected-inactive',
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: 'seed-trustee-keydates-elected-inactive',
          chapter: '7',
          appointmentType: 'elected',
          courtId: '0208',
          divisionCodes: ['081'],
          appointedDate: '2022-01-01',
          status: 'inactive',
          effectiveDate: '2024-01-01',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionName: 'Manhattan',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: 'seed-key-dates-ch13-standing-empty',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-ch13-standing-empty',
          appointmentId: 'seed-appointment-keydates-ch13-standing-empty',
          // All optional fields omitted - tests "No date added" placeholder state
          id: 'seed-key-dates-elected-inactive',
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId: 'seed-trustee-keydates-elected-inactive',
          appointmentId: 'seed-appointment-keydates-elected-inactive',
          bondIssuedDate: '2022-06-01',
          bondRenewalDate: '2025-06-01',
          updatedOn: '2025-03-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
