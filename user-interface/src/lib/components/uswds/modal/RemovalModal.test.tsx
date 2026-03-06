import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import RemovalModal, { RemovalModalRef } from './RemovalModal';
import React from 'react';

describe('RemovalModal', () => {
  let modalRef: React.RefObject<RemovalModalRef>;
  let mockOnDelete: () => Promise<void>;

  const defaultProps = {
    modalId: 'test-removal-modal',
    objectName: 'item',
  };

  const showModal = (ref: React.RefObject<RemovalModalRef>, onDelete = mockOnDelete) => {
    ref.current?.show({
      onDelete,
      openModalButtonRef: { current: { focus: vi.fn(), disableButton: vi.fn() } },
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    modalRef = React.createRef<RemovalModalRef>() as React.RefObject<RemovalModalRef>;
    mockOnDelete = vi.fn().mockResolvedValue(undefined);
  });

  test('should render heading with objectName', async () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    showModal(modalRef);

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
    });
  });

  test('should render standard content', async () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    showModal(modalRef);

    await waitFor(() => {
      expect(screen.getByText("This action can't be undone.")).toBeInTheDocument();
    });
  });

  test('should render "Yes, Delete" submit button', () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    expect(screen.getByTestId(`button-${defaultProps.modalId}-submit-button`)).toHaveTextContent(
      'Yes, Delete',
    );
  });

  test('should have secondary style on submit button', () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    expect(screen.getByTestId(`button-${defaultProps.modalId}-submit-button`)).toHaveClass(
      'usa-button--secondary',
    );
  });

  test('should render cancel button', () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    expect(screen.getByTestId(`button-${defaultProps.modalId}-cancel-button`)).toHaveTextContent(
      'Cancel',
    );
  });

  test('should call onDelete from show options when submit clicked', async () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    showModal(modalRef);

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
    });

    screen.getByTestId(`button-${defaultProps.modalId}-submit-button`).click();

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  test('should not call onDelete if show was never called', async () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    screen.getByTestId(`button-${defaultProps.modalId}-submit-button`).click();

    await waitFor(() => {
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  test('should disable submit button while deleting', async () => {
    const slowOnDelete = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    showModal(modalRef, slowOnDelete);

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId(
      `button-${defaultProps.modalId}-submit-button`,
    ) as HTMLButtonElement;
    submitButton.click();

    await waitFor(() => {
      expect(submitButton.disabled).toBe(true);
    });
  });

  test('should handle onDelete rejection gracefully without crashing', async () => {
    const failingOnDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));

    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    showModal(modalRef, failingOnDelete);

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
    });

    screen.getByTestId(`button-${defaultProps.modalId}-submit-button`).click();

    await waitFor(() => {
      expect(failingOnDelete).toHaveBeenCalled();
    });

    expect(screen.getByTestId(`modal-${defaultProps.modalId}`)).toBeInTheDocument();
  });

  test('should use onDelete from most recent show call', async () => {
    const firstOnDelete = vi.fn().mockResolvedValue(undefined);
    const secondOnDelete = vi.fn().mockResolvedValue(undefined);

    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    showModal(modalRef, firstOnDelete);

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
    });

    act(() => {
      showModal(modalRef, secondOnDelete);
    });

    screen.getByTestId(`button-${defaultProps.modalId}-submit-button`).click();

    await waitFor(() => {
      expect(secondOnDelete).toHaveBeenCalledTimes(1);
      expect(firstOnDelete).not.toHaveBeenCalled();
    });
  });

  test('should expose hide method through ref', () => {
    render(<RemovalModal {...defaultProps} ref={modalRef} />);

    expect(modalRef.current?.hide).toBeDefined();
    expect(() => modalRef.current?.hide()).not.toThrow();
  });
});
