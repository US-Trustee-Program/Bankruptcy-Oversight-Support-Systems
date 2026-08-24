export function removeExtraSpaces(s: string | undefined): string | undefined {
  if (s) {
    return s
      .trim()
      .split(/[\s,\t,\n]+/g)
      .join(' ');
  }

  return undefined;
}

export function formatCityStateZipCountry(
  city: string | undefined,
  state: string | undefined,
  zip: string | undefined,
  country: string | undefined,
): string | undefined {
  return removeExtraSpaces([city, state, zip, country].filter(Boolean).join(' '));
}
