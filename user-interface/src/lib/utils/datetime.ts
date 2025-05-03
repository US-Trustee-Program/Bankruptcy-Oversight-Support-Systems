const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
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
  day: '2-digit',
  hour: 'numeric',
  hour12: true,
  minute: '2-digit',
  month: '2-digit',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  timeZoneName: 'short',
  year: 'numeric',
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
export const SECOND = 1;
export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86400;
