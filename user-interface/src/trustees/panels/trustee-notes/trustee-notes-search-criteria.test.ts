import MockData from '@common/cams/test-utilities/mock-data';
import { filterTrusteeNotes, sortTrusteeNotes, SortOrder } from './trustee-notes-search-criteria';

const trusteeId = 'test-trustee-id';

describe('Search Criteria', () => {
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

  describe('filterTrusteeNotes', () => {
    const noteA = MockData.getTrusteeNote({
      trusteeId,
      title: 'Budget Review',
      content: '<p>Q1 financials look good.</p>',
    });
    const noteB = MockData.getTrusteeNote({
      trusteeId,
      title: 'Meeting Notes',
      content: '<p>Discussed <strong>budget</strong> allocation.</p>',
    });
    const noteC = MockData.getTrusteeNote({
      trusteeId,
      title: 'Miscellaneous',
      content: '<p>No relevant topics.</p>',
    });
    const notes = [noteA, noteB, noteC];

    it('returns all notes when query is empty', () => {
      expect(filterTrusteeNotes(notes, '')).toEqual(notes);
    });

    it('matches notes by title substring (case-insensitive)', () => {
      const result = filterTrusteeNotes(notes, 'review');
      expect(result).toEqual([noteA]);
    });

    it('matches notes by plain-text content substring (case-insensitive)', () => {
      const result = filterTrusteeNotes(notes, 'q1 financials');
      expect(result).toEqual([noteA]);
    });

    it('matches notes whose content contains the query inside an HTML tag body', () => {
      const result = filterTrusteeNotes(notes, 'allocation');
      expect(result).toEqual([noteB]);
    });

    it('does not match HTML tag names as content', () => {
      const result = filterTrusteeNotes(notes, 'strong');
      expect(result).toEqual([]);
    });

    it('matches across both title and content — returns union', () => {
      const result = filterTrusteeNotes(notes, 'budget');
      expect(result).toEqual([noteA, noteB]);
    });

    it('returns an empty array when no notes match', () => {
      expect(filterTrusteeNotes(notes, 'zzznomatch')).toEqual([]);
    });

    it('returns an empty array when given an empty array', () => {
      expect(filterTrusteeNotes([], 'budget')).toEqual([]);
    });

    it('does not mutate the original array', () => {
      const original = [...notes];
      filterTrusteeNotes(original, 'budget');
      expect(original).toEqual(notes);
    });
  });
});
