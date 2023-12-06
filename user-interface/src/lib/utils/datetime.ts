const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDate(dateOrString: Date | string): string {
  try {
    const date = dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
    return formatter.format(date);
  } catch {
    return dateOrString.toString();
  }
}
