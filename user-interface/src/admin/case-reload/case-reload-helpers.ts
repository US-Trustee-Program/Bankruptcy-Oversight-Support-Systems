/**
 * Builds a full case ID from division code and case number.
 * @param divisionCode - The division code (e.g., "081")
 * @param caseNumber - The case number (e.g., "23-12345")
 * @returns The full case ID (e.g., "081-23-12345")
 */
export function buildCaseId(divisionCode: string, caseNumber: string): string {
  return `${divisionCode}-${caseNumber}`;
}

/**
 * Parses API validation error messages to extract user-friendly error text.
 *
 * The API wrapper discards the fetch Response object and only returns a plain Error
 * with a formatted string message. This forces us to parse the error message string
 * to extract the status code instead of interrogating response.status directly.
 *
 * Error format: "STATUS Error - /path - actual message"
 *
 * @param error - The error thrown by the API
 * @returns A user-friendly error message
 */
export function parseApiValidationError(error: unknown): string {
  const err = error as Error;
  const errorMessage = err.message || '';

  // Extract status code from the error message
  const statusMatch = /^(\d{3})\s+Error/.exec(errorMessage);
  const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : null;

  if (status === 404) {
    return 'Case Not Found';
  }

  // Extract the actual error message after the path
  // Format: "STATUS Error - /path - actual message"
  const messageMatch = /^(\d{3})\s+Error\s+-\s+[^\s]+\s+-\s+(.+)$/.exec(errorMessage);
  const extractedMessage = messageMatch ? messageMatch[2] : '';

  return extractedMessage || 'Error encountered attempting to verify the case ID';
}
