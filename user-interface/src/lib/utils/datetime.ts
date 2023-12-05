const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });

export function formatDate(dateOrString: Date | string): string {
  try {
    const date = dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
    return formatter.format(date);
  } catch {
    return dateOrString.toString();
  }
}
