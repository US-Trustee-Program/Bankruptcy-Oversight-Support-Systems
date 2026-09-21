import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatLastTprSubmitted,
  formatTprDue,
  formatTprFrequency,
  formatTprReviewPeriod,
} from './tprFieldFormatters';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

function keyDates(overrides: Partial<TrusteeUpcomingKeyDates> = {}): TrusteeUpcomingKeyDates {
  return {
    id: 'doc-001',
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

describe('tprFieldFormatters', () => {
  describe('formatTprFrequency', () => {
    test.each([
      ['SEMI_ANNUAL', '6 months'],
      ['ANNUAL', 'One year'],
      ['BIANNUAL', 'Two years'],
    ] as const)('renders %s as "%s"', (code, expected) => {
      expect(formatTprFrequency(keyDates({ tprFrequency: code }))).toBe(expected);
    });

    test.each([
      ['the frequency is absent', keyDates()],
      ['there is no document', null],
    ])('reports no frequency selected when %s', (_label, data) => {
      expect(formatTprFrequency(data)).toBe('No frequency selected');
    });

    test('reports no frequency selected for a code the label map does not know', () => {
      // Stored data predates the current union in places, so an unknown code
      // must not leak through as "undefined".
      const data = keyDates({
        tprFrequency: 'QUARTERLY' as unknown as TrusteeUpcomingKeyDates['tprFrequency'],
      });

      expect(formatTprFrequency(data)).toBe('No frequency selected');
    });
  });

  describe('formatTprReviewPeriod', () => {
    test('renders a sentinel range as month/day only', () => {
      const data = keyDates({
        tprReviewPeriodStart: '1900-04-01',
        tprReviewPeriodEnd: '1900-03-31',
      });

      expect(formatTprReviewPeriod(data)).toBe('04/01 - 03/31');
    });

    test('renders a real-dated range with full dates', () => {
      const data = keyDates({
        tprReviewPeriodStart: '2025-01-01',
        tprReviewPeriodEnd: '2025-12-31',
      });

      expect(formatTprReviewPeriod(data)).toBe('01/01/2025 - 12/31/2025');
    });

    test.each([
      ['only the start is set', { tprReviewPeriodStart: '1900-04-01' }],
      ['only the end is set', { tprReviewPeriodEnd: '1900-03-31' }],
      ['neither is set', {}],
    ])('reports no date added when %s', (_label, overrides) => {
      expect(formatTprReviewPeriod(keyDates(overrides))).toBe('No date added');
    });

    test('reports no date added when there is no document', () => {
      expect(formatTprReviewPeriod(null)).toBe('No date added');
    });
  });

  describe('formatTprDue', () => {
    // The due year is derived from "now", so the clock is pinned to keep the
    // expected values literal rather than recomputed by the test.
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('resolves an EVEN due year to the next even year', () => {
      const data = keyDates({ tprDue: '1900-09-15', tprDueYearType: 'EVEN' });

      expect(formatTprDue(data)).toBe('09/15/2026');
    });

    test('resolves an ODD due year to the current odd year', () => {
      const data = keyDates({ tprDue: '1900-09-15', tprDueYearType: 'ODD' });

      expect(formatTprDue(data)).toBe('09/15/2025');
    });

    test.each([
      ['the year type is missing', { tprDue: '1900-09-15' }],
      ['the due date is missing', { tprDueYearType: 'EVEN' as const }],
      ['both are missing', {}],
    ])('reports no date added when %s', (_label, overrides) => {
      expect(formatTprDue(keyDates(overrides))).toBe('No date added');
    });

    test('reports no date added when there is no document', () => {
      expect(formatTprDue(null)).toBe('No date added');
    });
  });

  describe('formatLastTprSubmitted', () => {
    test('renders the stored date', () => {
      expect(formatLastTprSubmitted(keyDates({ pastTprSubmission: '2025-09-10' }))).toBe(
        '09/10/2025',
      );
    });

    test.each([
      ['the date is absent', keyDates()],
      ['there is no document', null],
    ])('reports no date added when %s', (_label, data) => {
      expect(formatLastTprSubmitted(data)).toBe('No date added');
    });
  });
});
