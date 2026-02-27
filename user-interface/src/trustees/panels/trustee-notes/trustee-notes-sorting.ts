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
