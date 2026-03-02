import { Note } from './types';

export type SortOrder = 'newest' | 'oldest' | 'title';
export const MINIMUM_SEARCH_CHARACTERS = 3;

export function sortNotes(notes: Note[], sortOrder: SortOrder): Note[] {
  const sorted = [...notes];

  switch (sortOrder) {
    case 'newest':
      return sorted.sort(
        (a, b) => new Date(b.updatedOn).getTime() - new Date(a.updatedOn).getTime(),
      );
    case 'oldest':
      return sorted.sort(
        (a, b) => new Date(a.updatedOn).getTime() - new Date(b.updatedOn).getTime(),
      );
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}

export function filterNotes(notes: Note[], query: string): Note[] {
  if (query.length < MINIMUM_SEARCH_CHARACTERS) {
    return notes;
  }

  const lowerQuery = query.toLowerCase();
  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.content.toLowerCase().includes(lowerQuery),
  );
}

export function buildNoteFormKey(
  cacheKeyPrefix: string,
  entityId: string,
  mode: 'create' | 'edit',
  noteId?: string,
): string {
  if (mode === 'create') {
    return `${cacheKeyPrefix}-${entityId}`;
  }
  return `${cacheKeyPrefix}-${entityId}-${noteId}`;
}

export function getEditDraftsPattern(cacheKeyPrefix: string, entityId: string): RegExp {
  return new RegExp(`^${cacheKeyPrefix}-${entityId}-`);
}
