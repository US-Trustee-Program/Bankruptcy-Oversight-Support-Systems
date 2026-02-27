import MockData from '@common/cams/test-utilities/mock-data';
import { sortTrusteeNotes, SortOrder } from './trustee-notes-sorting';

const trusteeId = 'test-trustee-id';

describe('sortTrusteeNotes', () => {
  const noteA = MockData.getTrusteeNote({
    trusteeId,
    title: 'Alpha',
    updatedOn: '2024-01-01T00:00:00.000Z',
  });
  const noteB = MockData.getTrusteeNote({
    trusteeId,
    title: 'Beta',
    updatedOn: '2024-06-01T00:00:00.000Z',
  });
  const noteC = MockData.getTrusteeNote({
    trusteeId,
    title: 'Gamma',
    updatedOn: '2024-12-01T00:00:00.000Z',
  });
  const unsorted = [noteB, noteC, noteA];

  it('sorts by newest (default) — most recent updatedOn first', () => {
    const result = sortTrusteeNotes(unsorted, 'newest');
    expect(result).toEqual([noteC, noteB, noteA]);
  });

  it('sorts by oldest — earliest updatedOn first', () => {
    const result = sortTrusteeNotes(unsorted, 'oldest');
    expect(result).toEqual([noteA, noteB, noteC]);
  });

  it('sorts by title — alphabetical order', () => {
    const result = sortTrusteeNotes(unsorted, 'title');
    expect(result).toEqual([noteA, noteB, noteC]);
  });

  it('does not mutate the original array', () => {
    const original = [noteB, noteC, noteA];
    sortTrusteeNotes(original, 'newest');
    expect(original).toEqual([noteB, noteC, noteA]);
  });

  it('returns an empty array when given an empty array', () => {
    expect(sortTrusteeNotes([], 'newest')).toEqual([]);
    expect(sortTrusteeNotes([], 'oldest')).toEqual([]);
    expect(sortTrusteeNotes([], 'title')).toEqual([]);
  });

  it('returns a single-element array unchanged', () => {
    expect(sortTrusteeNotes([noteA], 'newest')).toEqual([noteA]);
  });

  it.each<SortOrder>(['newest', 'oldest', 'title'])(
    'handles notes with equal sort keys for sort order "%s"',
    (order) => {
      const dup1 = MockData.getTrusteeNote({
        trusteeId,
        title: 'Same',
        updatedOn: '2024-03-01T00:00:00.000Z',
      });
      const dup2 = MockData.getTrusteeNote({
        trusteeId,
        title: 'Same',
        updatedOn: '2024-03-01T00:00:00.000Z',
      });
      const result = sortTrusteeNotes([dup1, dup2], order);
      expect(result).toHaveLength(2);
    },
  );
});
