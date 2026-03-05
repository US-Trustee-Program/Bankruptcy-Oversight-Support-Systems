import { describe, test, expect } from 'vitest';
import {
  sortNotes,
  filterNotes,
  buildNoteFormKey,
  getEditDraftsPattern,
  MINIMUM_SEARCH_CHARACTERS,
} from './notes-utils';
import { Note } from './types';

const createTestNote = (overrides: Partial<Note>): Note => ({
  id: 'note-1',
  entityId: 'entity-123',
  title: 'Test Note',
  content: 'Test content',
  updatedBy: { id: 'user-1', name: 'Test User' },
  updatedOn: '2024-01-15T10:00:00.000Z',
  createdBy: { id: 'user-1', name: 'Test User' },
  createdOn: '2024-01-15T10:00:00.000Z',
  ...overrides,
});

describe('sortNotes', () => {
  const note1 = createTestNote({
    id: 'note-1',
    title: 'Charlie',
    updatedOn: '2024-01-15T10:00:00.000Z',
  });
  const note2 = createTestNote({
    id: 'note-2',
    title: 'Alpha',
    updatedOn: '2024-01-20T10:00:00.000Z',
  });
  const note3 = createTestNote({
    id: 'note-3',
    title: 'Bravo',
    updatedOn: '2024-01-10T10:00:00.000Z',
  });

  test('should sort notes by newest first', () => {
    const notes = [note1, note2, note3];

    const result = sortNotes(notes, 'newest');

    expect(result[0].id).toBe('note-2');
    expect(result[1].id).toBe('note-1');
    expect(result[2].id).toBe('note-3');
  });

  test('should sort notes by oldest first', () => {
    const notes = [note1, note2, note3];

    const result = sortNotes(notes, 'oldest');

    expect(result[0].id).toBe('note-3');
    expect(result[1].id).toBe('note-1');
    expect(result[2].id).toBe('note-2');
  });

  test('should sort notes by title A-Z', () => {
    const notes = [note1, note2, note3];

    const result = sortNotes(notes, 'title');

    expect(result[0].title).toBe('Alpha');
    expect(result[1].title).toBe('Bravo');
    expect(result[2].title).toBe('Charlie');
  });

  test('should not mutate original array', () => {
    const notes = [note1, note2, note3];
    const originalOrder = notes.map((n) => n.id);

    sortNotes(notes, 'newest');

    expect(notes.map((n) => n.id)).toEqual(originalOrder);
  });

  test('should handle empty array', () => {
    const result = sortNotes([], 'newest');

    expect(result).toEqual([]);
  });

  test('should handle single note', () => {
    const notes = [note1];

    const result = sortNotes(notes, 'title');

    expect(result).toEqual([note1]);
  });
});

describe('filterNotes', () => {
  const note1 = createTestNote({
    id: 'note-1',
    title: 'Meeting Notes',
    content: 'Discussed the bankruptcy case details',
  });
  const note2 = createTestNote({
    id: 'note-2',
    title: 'Follow-up Required',
    content: 'Need to contact trustee about missing documents',
  });
  const note3 = createTestNote({
    id: 'note-3',
    title: 'Case Review',
    content: 'Reviewed filing documentation and schedules',
  });

  test('should filter notes by title match', () => {
    const notes = [note1, note2, note3];

    const result = filterNotes(notes, 'meeting');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('note-1');
  });

  test('should filter notes by content match', () => {
    const notes = [note1, note2, note3];

    const result = filterNotes(notes, 'trustee');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('note-2');
  });

  test('should filter notes matching both title and content', () => {
    const notes = [note1, note2, note3];

    const result = filterNotes(notes, 'case');

    expect(result).toHaveLength(2);
    expect(result.map((n) => n.id)).toEqual(['note-1', 'note-3']);
  });

  test('should be case-insensitive', () => {
    const notes = [note1, note2, note3];

    const result = filterNotes(notes, 'MEETING');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('note-1');
  });

  test('should return all notes if query is below minimum characters', () => {
    const notes = [note1, note2, note3];

    const resultShort = filterNotes(notes, 'ab');
    const resultEmpty = filterNotes(notes, '');

    expect(resultShort).toHaveLength(3);
    expect(resultEmpty).toHaveLength(3);
  });

  test('should return empty array if no matches', () => {
    const notes = [note1, note2, note3];

    const result = filterNotes(notes, 'nonexistent');

    expect(result).toEqual([]);
  });

  test('should handle empty notes array', () => {
    const result = filterNotes([], 'search');

    expect(result).toEqual([]);
  });

  test('should handle query at exact minimum character length', () => {
    const notes = [note1];

    const result = filterNotes(notes, 'mee');

    expect(result).toHaveLength(1);
  });
});

describe('buildNoteFormKey', () => {
  test('should build create mode cache key', () => {
    const result = buildNoteFormKey('case-notes', 'case-123', 'create');

    expect(result).toBe('case-notes-case-123');
  });

  test('should build edit mode cache key with noteId', () => {
    const result = buildNoteFormKey('case-notes', 'case-123', 'edit', 'note-456');

    expect(result).toBe('case-notes-case-123-note-456');
  });

  test('should work with trustee notes prefix', () => {
    const createKey = buildNoteFormKey('trustee-notes', 'trustee-789', 'create');
    const editKey = buildNoteFormKey('trustee-notes', 'trustee-789', 'edit', 'note-111');

    expect(createKey).toBe('trustee-notes-trustee-789');
    expect(editKey).toBe('trustee-notes-trustee-789-note-111');
  });

  test('should handle different entityId formats', () => {
    const result1 = buildNoteFormKey('notes', '081-23-12345', 'create');
    const result2 = buildNoteFormKey('notes', 'entity_with_underscores', 'create');

    expect(result1).toBe('notes-081-23-12345');
    expect(result2).toBe('notes-entity_with_underscores');
  });
});

describe('getEditDraftsPattern', () => {
  test('should generate regex pattern for edit drafts', () => {
    const pattern = getEditDraftsPattern('case-notes', 'case-123');

    expect(pattern).toBeInstanceOf(RegExp);
    expect(pattern.source).toBe('^case-notes-case-123-');
  });

  test('should match edit draft keys', () => {
    const pattern = getEditDraftsPattern('case-notes', 'case-123');

    expect(pattern.test('case-notes-case-123-note-1')).toBe(true);
    expect(pattern.test('case-notes-case-123-note-2')).toBe(true);
    expect(pattern.test('case-notes-case-123-note-999')).toBe(true);
  });

  test('should not match create draft key', () => {
    const pattern = getEditDraftsPattern('case-notes', 'case-123');

    expect(pattern.test('case-notes-case-123')).toBe(false);
  });

  test('should not match different entity keys', () => {
    const pattern = getEditDraftsPattern('case-notes', 'case-123');

    expect(pattern.test('case-notes-case-456-note-1')).toBe(false);
    expect(pattern.test('trustee-notes-case-123-note-1')).toBe(false);
  });

  test('should handle special characters in prefix and entityId', () => {
    const pattern = getEditDraftsPattern('notes-v2', 'entity_123');

    expect(pattern.test('notes-v2-entity_123-note-1')).toBe(true);
    expect(pattern.test('notes-v2-entity_456-note-1')).toBe(false);
  });
});

describe('MINIMUM_SEARCH_CHARACTERS constant', () => {
  test('should be 3 characters', () => {
    expect(MINIMUM_SEARCH_CHARACTERS).toBe(3);
  });
});
