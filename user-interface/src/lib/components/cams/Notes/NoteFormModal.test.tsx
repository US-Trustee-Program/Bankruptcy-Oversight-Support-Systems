import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import NoteFormModal, { NoteFormModalRef } from './NoteFormModal';
import { NoteInput } from './types';
import React from 'react';
import LocalFormCache from '@/lib/utils/local-form-cache';

describe('NoteFormModal', () => {
  let modalRef: React.RefObject<NoteFormModalRef>;
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnModalClosed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    modalRef = React.createRef<NoteFormModalRef>();
    mockOnSave = vi.fn().mockResolvedValue(undefined);
    mockOnModalClosed = vi.fn();

    vi.spyOn(LocalFormCache, 'saveForm').mockReturnValue(undefined);
    vi.spyOn(LocalFormCache, 'clearForm').mockReturnValue(undefined);
  });

  test('should render modal with create mode heading', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: '',
      content: '',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });
  });

  test('should render modal with edit mode heading', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      id: 'note-456',
      mode: 'edit',
      entityId: 'entity-123',
      title: 'Existing Note',
      content: 'Existing content',
      cacheKey: 'notes-entity-123-note-456',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: 'Existing Note',
      initialContent: 'Existing content',
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Note')).toBeInTheDocument();
    });
  });

  test('should render form fields', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: '',
      content: '',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByTestId('note-title-input')).toBeInTheDocument();
    });

    expect(screen.getByText('Note Title')).toBeInTheDocument();
    expect(screen.getByText('Note Text')).toBeInTheDocument();
  });

  test('should use provided cache key for draft storage', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    const cacheKey = 'notes-entity-123';
    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test',
      content: '<p>Test</p>',
      cacheKey,
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(LocalFormCache.saveForm).toHaveBeenCalled();
      const calls = (LocalFormCache.saveForm as ReturnType<typeof vi.fn>).mock.calls;
      if (calls.length > 0) {
        expect(calls[0][0]).toBe(cacheKey);
      }
    });
  });

  test('should call onSave callback with note data on submit in create mode', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    const expectedNoteData: NoteInput = {
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
    };

    const saveButton = screen.getByText('Save');
    saveButton.click();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining(expectedNoteData));
    });
  });

  test('should include note id when in edit mode', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      id: 'note-456',
      mode: 'edit',
      entityId: 'entity-123',
      title: 'Updated Note',
      content: '<p>Updated content</p>',
      cacheKey: 'notes-entity-123-note-456',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: 'Original Note',
      initialContent: '<p>Original content</p>',
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Note')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save');
    saveButton.click();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'note-456',
          entityId: 'entity-123',
          title: 'Updated Note',
          content: '<p>Updated content</p>',
        }),
      );
    });
  });

  test('should show validation error when title is missing', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: '',
      content: '<p>Content only</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save');
    saveButton.click();

    await waitFor(() => {
      expect(screen.getByText('Title and content are both required inputs.')).toBeInTheDocument();
    });
  });

  test('should show validation error when content is missing', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Title only',
      content: '',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save');
    saveButton.click();

    await waitFor(() => {
      expect(screen.getByText('Title and content are both required inputs.')).toBeInTheDocument();
    });
  });

  test('should show error message when onSave fails', async () => {
    const failingOnSave = vi.fn().mockRejectedValue(new Error('Save failed'));

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={failingOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save');
    saveButton.click();

    await waitFor(() => {
      expect(screen.getByText('There was a problem submitting the note.')).toBeInTheDocument();
    });
  });

  test('should clear form on cancel', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Discard');
    cancelButton.click();

    await waitFor(() => {
      expect(LocalFormCache.clearForm).toHaveBeenCalled();
    });
  });

  test('should call onModalClosed when modal is closed', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    modalRef.current?.hide();

    await waitFor(() => {
      expect(mockOnModalClosed).toHaveBeenCalled();
    });
  });
});
