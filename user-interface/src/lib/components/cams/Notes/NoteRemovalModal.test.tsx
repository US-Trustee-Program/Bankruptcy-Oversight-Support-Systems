import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import NoteRemovalModal, { NoteRemovalModalRef } from './NoteRemovalModal';
import React from 'react';

describe('NoteRemovalModal', () => {
  let modalRef: React.RefObject<NoteRemovalModalRef>;
  let mockOnDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    modalRef = React.createRef<NoteRemovalModalRef>();
    mockOnDelete = vi.fn().mockResolvedValue(undefined);
  });

  test('should render modal with confirmation message', async () => {
    render(
      <NoteRemovalModal modalId="test-removal-modal" onDelete={mockOnDelete} ref={modalRef} />,
    );

    modalRef.current?.show({
      id: 'note-123',
      buttonId: 'remove-button-0',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
    });

    await waitFor(() => {
      expect(screen.getByText('Delete note?')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Would you like to delete this note? This action cannot be undone.'),
    ).toBeInTheDocument();
  });

  test('should call onDelete with note id when delete button clicked', async () => {
    render(
      <NoteRemovalModal modalId="test-removal-modal" onDelete={mockOnDelete} ref={modalRef} />,
    );

    modalRef.current?.show({
      id: 'note-456',
      buttonId: 'remove-button-1',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
    });

    await waitFor(() => {
      expect(screen.getByText('Delete note?')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    deleteButton.click();

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith('note-456');
    });
  });

  test('should disable delete button while deleting', async () => {
    const slowOnDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        }),
    );

    render(
      <NoteRemovalModal modalId="test-removal-modal" onDelete={slowOnDelete} ref={modalRef} />,
    );

    modalRef.current?.show({
      id: 'note-789',
      buttonId: 'remove-button-2',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
    });

    await waitFor(() => {
      expect(screen.getByText('Delete note?')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete') as HTMLButtonElement;
    deleteButton.click();

    await waitFor(() => {
      expect(deleteButton.disabled).toBe(true);
    });
  });

  test('should render cancel button', async () => {
    render(
      <NoteRemovalModal modalId="test-removal-modal" onDelete={mockOnDelete} ref={modalRef} />,
    );

    modalRef.current?.show({
      id: 'note-111',
      buttonId: 'remove-button-4',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
    });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  test('should handle onDelete rejection gracefully', async () => {
    const failingOnDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));

    render(
      <NoteRemovalModal modalId="test-removal-modal" onDelete={failingOnDelete} ref={modalRef} />,
    );

    modalRef.current?.show({
      id: 'note-error',
      buttonId: 'remove-button-5',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
    });

    await waitFor(() => {
      expect(screen.getByText('Delete note?')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    deleteButton.click();

    await waitFor(() => {
      expect(failingOnDelete).toHaveBeenCalled();
    });
  });

  test('should not call onDelete if id is missing', async () => {
    render(
      <NoteRemovalModal modalId="test-removal-modal" onDelete={mockOnDelete} ref={modalRef} />,
    );

    modalRef.current?.show({
      id: '',
      buttonId: 'remove-button-6',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
    });

    await waitFor(() => {
      expect(screen.getByText('Delete note?')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    deleteButton.click();

    await waitFor(() => {
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });
});
