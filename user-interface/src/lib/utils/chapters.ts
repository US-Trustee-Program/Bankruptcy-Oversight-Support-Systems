export function formatChapterType(chapter: string): string {
  const chapterLabels: Record<string, string> = {
    '7-panel': '7 - Panel',
    '7-non-panel': '7 - Non-Panel',
    '11': '11',
    '11-subchapter-v': '11 - Subchapter V',
    '12': '12',
    '13': '13',
  };

  return chapterLabels[chapter] || chapter;
}
