import { describe, test, expect } from 'vitest';
import {
  buildCompletionTag,
  formatDateOrDefault,
  NO_DATE,
  tprReviewPeriodField,
} from './upcomingKeyDatesFieldConfig';
import type { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';

describe('formatDateOrDefault', () => {
  test('formats a defined ISO date as MM/DD/YYYY', () => {
    expect(formatDateOrDefault('2023-06-03')).toBe('06/03/2023');
  });

  test('returns NO_DATE when the date is undefined', () => {
    expect(formatDateOrDefault(undefined)).toBe(NO_DATE);
  });
});

describe('buildCompletionTag', () => {
  test('defaults to "Complete"/"Incomplete" labels when none are given', () => {
    expect(buildCompletionTag(2026, 'CLOSED', 'CLOSED', 'my-tag')).toEqual({
      label: 'Complete for 2026',
      color: 'green',
      id: 'my-tag',
    });
    expect(buildCompletionTag(2026, 'NOT_CLOSED', 'CLOSED', 'my-tag')).toEqual({
      label: 'Incomplete for 2026',
      color: 'red',
      id: 'my-tag',
    });
  });

  test('uses custom labels when given', () => {
    const labels = { closed: 'Closed', notClosed: 'Not Closed' };

    expect(buildCompletionTag(2026, 'CLOSED', 'CLOSED', 'my-tag', labels)).toEqual({
      label: 'Closed for 2026',
      color: 'green',
      id: 'my-tag',
    });
    expect(buildCompletionTag(2026, 'NOT_CLOSED', 'CLOSED', 'my-tag', labels)).toEqual({
      label: 'Not Closed for 2026',
      color: 'red',
      id: 'my-tag',
    });
  });

  test('returns undefined when year or status is unset', () => {
    expect(buildCompletionTag(undefined, 'CLOSED', 'CLOSED', 'my-tag')).toBeUndefined();
    expect(buildCompletionTag(2026, undefined, 'CLOSED', 'my-tag')).toBeUndefined();
  });

  test('renders a green tag when the status matches the closed value', () => {
    expect(buildCompletionTag(2025, 'COMPLETE', 'COMPLETE', 'tag-id')).toEqual({
      label: 'Complete for 2025',
      color: 'green',
      id: 'tag-id',
    });
  });

  test('renders a red tag when the status does not match the closed value', () => {
    expect(buildCompletionTag(2024, 'INCOMPLETE', 'COMPLETE', 'tag-id')).toEqual({
      label: 'Incomplete for 2024',
      color: 'red',
      id: 'tag-id',
    });
  });

  // The year and status are stored as a pair; half a pair reports nothing. The
  // document type declares these optional, but the input type declares them
  // nullable and the values ultimately come from stored data, so null has to be
  // treated the same as absent. Letting null through rendered 'Incomplete for
  // null', and worse, a null status rendered a confident 'Incomplete for <year>'
  // for a report whose status was simply unset.
  test.each([
    ['the year is undefined', undefined, 'COMPLETE'],
    ['the year is null', null, 'COMPLETE'],
    ['the status is undefined', 2025, undefined],
    ['the status is null', 2025, null],
    ['both are null', null, null],
  ])('renders no tag when %s', (_label, year, status) => {
    expect(buildCompletionTag(year, status, 'COMPLETE', 'tag-id')).toBeUndefined();
  });
});

describe('tprReviewPeriodField', () => {
  test('renders month/day range when start date has sentinel year (1900)', () => {
    const data: Partial<TrusteeUpcomingKeyDates> = {
      tprReviewPeriodStart: '1900-04-01',
      tprReviewPeriodEnd: '1900-03-31',
    };

    const result = tprReviewPeriodField(data as TrusteeUpcomingKeyDates);

    expect(result.value).toBe('04/01 - 03/31');
  });

  test('renders full dates when start and end have real years', () => {
    const data: Partial<TrusteeUpcomingKeyDates> = {
      tprReviewPeriodStart: '2025-01-01',
      tprReviewPeriodEnd: '2025-12-31',
    };

    const result = tprReviewPeriodField(data as TrusteeUpcomingKeyDates);

    expect(result.value).toBe('01/01/2025 - 12/31/2025');
  });

  test.each([
    [
      'the start date is missing',
      { tprReviewPeriodStart: undefined, tprReviewPeriodEnd: '2025-12-31' },
    ],
    [
      'the end date is missing',
      { tprReviewPeriodStart: '2025-01-01', tprReviewPeriodEnd: undefined },
    ],
    ['there is no key dates document', null],
  ])('returns NO_DATE when %s', (_label, data) => {
    const result = tprReviewPeriodField(data as TrusteeUpcomingKeyDates | null);

    expect(result.value).toBe(NO_DATE);
  });
});
