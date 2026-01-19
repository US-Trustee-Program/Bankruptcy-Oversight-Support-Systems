/**
 * Copies text to the clipboard using the Clipboard API.
 * Silently fails if clipboard API is unavailable or rejects.
 * @param text - The text to copy to clipboard
 */
export function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {
    // Silently fail - clipboard API may be unavailable or reject (non-HTTPS, older browsers, etc.)
  });
}

/**
 * Formats a Zoom meeting ID by inserting spaces for readability.
 * Expected format: XXX XXX XXXX (or XXX XXX XXXXX for 11-digit IDs)
 * @param meetingId - The meeting ID string (9-11 digits)
 * @returns Formatted meeting ID with spaces, or original if not 9-11 digits
 */
export function formatMeetingId(meetingId: string): string {
  if (meetingId.length >= 9 && meetingId.length <= 11) {
    return `${meetingId.slice(0, 3)} ${meetingId.slice(3, 6)} ${meetingId.slice(6)}`;
  }
  return meetingId;
}
