import { TrusteeNote } from '@common/cams/trustee-notes';

export type SortOrder = 'newest' | 'oldest' | 'title';

export function sortTrusteeNotes(notes: TrusteeNote[], sortOrder: SortOrder): TrusteeNote[] {
  return [...notes].sort((a, b) => {
    if (sortOrder === 'oldest') {
      return new Date(a.updatedOn).getTime() - new Date(b.updatedOn).getTime();
    }
    if (sortOrder === 'title') {
      return a.title.localeCompare(b.title);
    }
    // newest (default)
    return new Date(b.updatedOn).getTime() - new Date(a.updatedOn).getTime();
  });
}

export function filterTrusteeNotes(notes: TrusteeNote[], query: string): TrusteeNote[] {
  if (!query) return notes;
  const q = query.toLowerCase();
  return notes.filter((note) => {
    const plainContent = note.content.replace(/<[^>]*>/g, '');
    return note.title.toLowerCase().includes(q) || plainContent.toLowerCase().includes(q);
  });
}
