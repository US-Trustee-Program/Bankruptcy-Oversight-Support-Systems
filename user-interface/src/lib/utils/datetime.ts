const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDate(dateOrString: Date | string): string {
  try {
    const date = dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
    return dateFormatter.format(date);
  } catch {
    return dateOrString.toString();
  }
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

export function formatDateTime(dateOrString: Date | string): string {
  try {
    const date = dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
    return dateTimeFormatter.format(date).replace(',', '');
  } catch {
    return dateOrString.toString();
  }
}

export function sortByDate(dateA: Date | string, dateB: Date | string): number {
  // older date first
  if (dateA > dateB) {
    return 1;
  } else if (dateA == dateB) {
    return 0;
  } else {
    return -1;
  }
}

export function sortByDateReverse(dateA: Date | string, dateB: Date | string): number {
  // newest date first
  return sortByDate(dateA, dateB) * -1;
}

// Time units expressed in seconds:
const SECOND = 1;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const THREE_DAYS = DAY * 3;

const DateTimeUtils = {
  SECOND,
  MINUTE,
  HOUR,
  DAY,
  THREE_DAYS,
};

export default DateTimeUtils;
