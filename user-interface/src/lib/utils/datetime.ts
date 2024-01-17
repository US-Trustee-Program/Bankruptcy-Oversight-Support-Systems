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

export function sortDates(dateA: Date | string, dateB: Date | string): number {
  if (dateA > dateB) {
    return 1;
  } else if (dateA == dateB) {
    return 0;
  } else {
    return -1;
  }
}

export function sortDatesRev(dateA: Date | string, dateB: Date | string): number {
  return sortDates(dateA, dateB) * -1;
}
