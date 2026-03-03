import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Notes, { NotesRef } from './Notes';
import { Note } from './types';
import LocalFormCache from '@/lib/utils/local-form-cache';
import React from 'react';

const createTestNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  entityId: 'entity-123',
  title: 'Test Note',
  content: '<p>Test content</p>',
  updatedBy: { id: 'user-1', name: 'Test User' },
  updatedOn: '2024-01-15T10:00:00.000Z',
  createdBy: { id: 'user-1', name: 'Test User' },
  createdOn: '2024-01-15T10:00:00.000Z',
  ...overrides,
});

describe('Notes Component', () => {
  let mockOnCreateNote: ReturnType<typeof vi.fn>;
  let mockOnUpdateNote: ReturnType<typeof vi.fn>;
  let mockOnDeleteNote: ReturnType<typeof vi.fn>;
  let notesRef: React.RefObject<NotesRef>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnCreateNote = vi.fn().mockResolvedValue(undefined);
    mockOnUpdateNote = vi.fn().mockResolvedValue(undefined);
    mockOnDeleteNote = vi.fn().mockResolvedValue(undefined);
    notesRef = React.createRef<NotesRef>();

    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue(null);
    vi.spyOn(LocalFormCache, 'getFormsByPattern').mockReturnValue([]);
  });

  test('should render with title', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByText('Test Notes')).toBeInTheDocument();
  });

  test('should display loading indicator when isLoading is true', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={true}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByTestId('notes-loading-indicator')).toBeInTheDocument();
  });

  test('should display empty state when no notes exist', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByTestId('empty-notes')).toBeInTheDocument();
    expect(screen.getByText('No notes available.')).toBeInTheDocument();
  });

  test('should display custom empty message', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
        emptyMessage="Custom empty message"
      />,
    );

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  test('should render notes list when notes exist', () => {
    const notes = [
      createTestNote({ id: 'note-1', title: 'Note 1' }),
      createTestNote({ id: 'note-2', title: 'Note 2' }),
    ];

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={notes}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByTestId('searchable-notes')).toBeInTheDocument();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Note 2')).toBeInTheDocument();
  });

  test('should show "Add Note" button', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByText('Add Note')).toBeInTheDocument();
  });

  test('should show "Continue Editing" when draft exists', () => {
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({
      value: { entityId: 'entity-123', title: 'Draft', content: '<p>Draft</p>' },
      expiresAfter: Date.now() + 100000,
    });

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByText('Continue Editing')).toBeInTheDocument();
  });

  test('should display draft alert when create draft exists', () => {
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({
      value: { entityId: 'entity-123', title: 'Draft', content: '<p>Draft</p>' },
      expiresAfter: Date.now() + 100000,
    });

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByTestId('draft-note-alert')).toBeInTheDocument();
    expect(screen.getByText('Draft Note Available')).toBeInTheDocument();
  });

  test('should render search input with default placeholder', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByText('Find note by title or content')).toBeInTheDocument();
  });

  test('should render search input with custom placeholder', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
        searchPlaceholder="Search notes"
      />,
    );

    expect(screen.getByText('Search notes')).toBeInTheDocument();
  });

  test('should render sort dropdown', () => {
    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={[]}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('Newest First')).toBeInTheDocument();
    expect(screen.getByText('Oldest First')).toBeInTheDocument();
    expect(screen.getByText('Title A-Z')).toBeInTheDocument();
  });

  test('should filter notes by search query', async () => {
    const notes = [
      createTestNote({ id: 'note-1', title: 'Meeting Notes', content: '<p>Important</p>' }),
      createTestNote({ id: 'note-2', title: 'Follow-up', content: '<p>Call back</p>' }),
    ];

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={notes}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    const searchInput = screen.getByLabelText('Find note by title or content');
    fireEvent.change(searchInput, { target: { value: 'meeting' } });

    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      expect(screen.queryByText('Follow-up')).not.toBeInTheDocument();
    });
  });

  test('should sort notes by newest first', async () => {
    const notes = [
      createTestNote({ id: 'note-1', title: 'Older', updatedOn: '2024-01-10T10:00:00.000Z' }),
      createTestNote({ id: 'note-2', title: 'Newer', updatedOn: '2024-01-20T10:00:00.000Z' }),
    ];

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={notes}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    const sortSelect = screen.getByLabelText('Sort by') as HTMLSelectElement;
    fireEvent.change(sortSelect, { target: { value: 'newest' } });

    await waitFor(() => {
      const noteElements = screen.getAllByRole('listitem');
      expect(noteElements[0]).toHaveTextContent('Newer');
      expect(noteElements[1]).toHaveTextContent('Older');
    });
  });

  test('should sort notes by oldest first', async () => {
    const notes = [
      createTestNote({ id: 'note-1', title: 'Newer', updatedOn: '2024-01-20T10:00:00.000Z' }),
      createTestNote({ id: 'note-2', title: 'Older', updatedOn: '2024-01-10T10:00:00.000Z' }),
    ];

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={notes}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    const sortSelect = screen.getByLabelText('Sort by') as HTMLSelectElement;
    fireEvent.change(sortSelect, { target: { value: 'oldest' } });

    await waitFor(() => {
      const noteElements = screen.getAllByRole('listitem');
      expect(noteElements[0]).toHaveTextContent('Older');
      expect(noteElements[1]).toHaveTextContent('Newer');
    });
  });

  test('should sort notes by title A-Z', async () => {
    const notes = [
      createTestNote({ id: 'note-1', title: 'Zebra' }),
      createTestNote({ id: 'note-2', title: 'Alpha' }),
    ];

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={notes}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
      />,
    );

    const sortSelect = screen.getByLabelText('Sort by') as HTMLSelectElement;
    fireEvent.change(sortSelect, { target: { value: 'title' } });

    await waitFor(() => {
      const noteElements = screen.getAllByRole('listitem');
      expect(noteElements[0]).toHaveTextContent('Alpha');
      expect(noteElements[1]).toHaveTextContent('Zebra');
    });
  });

  test('should expose focusEditButton via ref', () => {
    const notes = [createTestNote({ id: 'note-1', title: 'Test Note' })];

    render(
      <Notes
        entityId="entity-123"
        title="Test Notes"
        notes={notes}
        isLoading={false}
        onCreateNote={mockOnCreateNote}
        onUpdateNote={mockOnUpdateNote}
        onDeleteNote={mockOnDeleteNote}
        createDraftKey="notes-entity-123"
        editDraftKeyPrefix="notes-entity-123"
        ref={notesRef}
      />,
    );

    expect(notesRef.current).toBeDefined();
    expect(notesRef.current?.focusEditButton).toBeDefined();
  });
});
