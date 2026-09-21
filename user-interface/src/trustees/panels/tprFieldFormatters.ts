import {
  TrusteeUpcomingKeyDates,
  isoToMMDD,
  isoToMMDDYYYY,
  isoRangeToMMDD,
  calculateTprDueYear,
} from '@common/cams/trustee-upcoming-key-dates';

export const NO_DATE = 'No date added';
export const NO_FREQUENCY = 'No frequency selected';

const FREQUENCY_LABELS: Record<string, string> = {
  BIANNUAL: 'Two years',
  ANNUAL: 'One year',
  SEMI_ANNUAL: '6 months',
};

export function formatTprFrequency(data: TrusteeUpcomingKeyDates | null): string {
  if (!data?.tprFrequency) return NO_FREQUENCY;
  return FREQUENCY_LABELS[data.tprFrequency] ?? NO_FREQUENCY;
}

/**
 * Review periods are stored either as sentinel dates (1900-MM-DD), meaning a
 * recurring month/day with no particular year, or as real dates.
 */
export function formatTprReviewPeriod(data: TrusteeUpcomingKeyDates | null): string {
  const { tprReviewPeriodStart: start, tprReviewPeriodEnd: end } = data ?? {};
  if (!start || !end) return NO_DATE;
  if (start.startsWith('1900-')) return isoRangeToMMDD(start, end);
  return `${isoToMMDDYYYY(start)} - ${isoToMMDDYYYY(end)}`;
}

export function formatTprDue(data: TrusteeUpcomingKeyDates | null): string {
  if (!data?.tprDue || !data?.tprDueYearType) return NO_DATE;
  const year = calculateTprDueYear(data.tprDueYearType, new Date().getFullYear());
  return `${isoToMMDD(data.tprDue)}/${year}`;
}

export function formatLastTprSubmitted(data: TrusteeUpcomingKeyDates | null): string {
  return data?.pastTprSubmission ? isoToMMDDYYYY(data.pastTprSubmission) : NO_DATE;
}
