import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'DATE-HELPER';

export function getDate(year: number, month: number, dayOfMonth: number): Date {
  if (month > 12 || dayOfMonth > 31) {
    throw new CamsError(MODULE_NAME, {
      message: 'month cannot be greater than 12 and dayOfMonth cannot be greater than 31',
    });
  } else if (month === 0 || dayOfMonth === 0) {
    throw new CamsError(MODULE_NAME, {
      message: 'month and dayOfMonth should be real month and day numbers, not zero-based',
    });
  }
  return new Date(year, month - 1, dayOfMonth);
}

export function calculateDifferenceInMonths(left: Date, right: Date): number {
  let earlier, later: Date;
  if (left.getFullYear() < right.getFullYear()) {
    earlier = left;
    later = right;
  } else if (left.getFullYear() > right.getFullYear()) {
    earlier = right;
    later = left;
  } else if (left.getMonth() < right.getMonth()) {
    earlier = left;
    later = right;
  } else if (left.getMonth() > right.getMonth()) {
    earlier = right;
    later = left;
  } else {
    return 0;
  }
  const years = Math.abs(earlier.getFullYear() - later.getFullYear());
  const incompleteYear = later.getMonth() < earlier.getMonth();
  const months = later.getMonth() - earlier.getMonth();
  const realMonths = months < 0 ? 12 + months : months;
  const incompleteMonth = later.getDate() < earlier.getDate();
  const monthsDiff = incompleteYear ? years * 12 + realMonths - 12 : years * 12 + realMonths;
  return incompleteMonth ? monthsDiff - 1 : monthsDiff;
}

export function getYearMonthDayStringFromDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function getMonthDayYearStringFromDate(date: Date) {
  const monthString = padDateElement(date.getMonth() + 1);
  const dateString = padDateElement(date.getDate());
  return `${date.getFullYear()}-${monthString}-${dateString}`;
}

function padDateElement(value: number) {
  if (value < 10) return '0' + value;
  return value.toString();
}

export function sortListOfDates(dates: Date[], order: 'chronological' | 'reverse' = 'reverse') {
  dates.sort((a: Date, b: Date) => {
    if (order === 'chronological') {
      return a.valueOf() - b.valueOf();
    } else {
      return b.valueOf() - a.valueOf();
    }
  });
}
