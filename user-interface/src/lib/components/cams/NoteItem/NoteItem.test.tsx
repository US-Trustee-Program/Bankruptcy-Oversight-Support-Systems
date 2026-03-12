import { render, screen } from '@testing-library/react';
import React from 'react';
import { NoteItem } from './NoteItem';
import { Cacheable } from '@/lib/utils/local-cache';
import { NoteInput } from '../Notes/types';

const baseNote = {
  id: 'note-1',
  title: 'Test Note Title',
  content: '<p>Test content</p>',
  updatedOn: '2024-01-15T10:00:00.000Z',
  updatedBy: { name: 'Jane Doe' },
};

const modalRef = React.createRef();
const removeModalRef = React.createRef();

const defaultProps = {
  note: baseNote,
  index: 0,
  draft: null,
  canEdit: false,
  canRemove: false,
  modalId: 'note-modal',
  removeModalId: 'note-remove-modal',
  modalRef,
  removeModalRef,
  editButtonProps: {},
  removeButtonProps: {},
  getDraftAlertMessage: (draft: Cacheable<NoteInput>) =>
    `Draft expires on ${new Date(draft.expiresAfter).toLocaleDateString()}`,
};

describe('NoteItem', () => {
  test('renders note title and content', () => {
    render(<NoteItem {...defaultProps} />);
    expect(screen.getByTestId('note-item-0-header')).toHaveTextContent('Test Note Title');
  });

  test('shows "Created by:" when note has no previousVersionId', () => {
    render(<NoteItem {...defaultProps} />);
    expect(screen.getByTestId('note-item-creation-date-0')).toHaveTextContent('Created by:');
  });

  test('shows "Edited by:" when note has a previousVersionId', () => {
    render(<NoteItem {...defaultProps} note={{ ...baseNote, previousVersionId: 'prev-note-1' }} />);
    expect(screen.getByTestId('note-item-creation-date-0')).toHaveTextContent('Edited by:');
  });

  test('does not show edit button when canEdit is false', () => {
    render(<NoteItem {...defaultProps} canEdit={false} />);
    expect(screen.queryByLabelText(`Edit note titled ${baseNote.title}`)).not.toBeInTheDocument();
  });

  test('shows edit button when canEdit is true', () => {
    render(<NoteItem {...defaultProps} canEdit={true} />);
    expect(screen.getByLabelText(`Edit note titled ${baseNote.title}`)).toBeInTheDocument();
  });

  test('does not show remove button when canRemove is false', () => {
    render(<NoteItem {...defaultProps} canRemove={false} />);
    expect(screen.queryByLabelText(`Remove note titled ${baseNote.title}`)).not.toBeInTheDocument();
  });

  test('shows remove button when canRemove is true', () => {
    render(<NoteItem {...defaultProps} canRemove={true} />);
    expect(screen.getByLabelText(`Remove note titled ${baseNote.title}`)).toBeInTheDocument();
  });

  test('does not show draft alert when draft is null', () => {
    render(<NoteItem {...defaultProps} draft={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('shows draft alert when draft is provided', () => {
    const draft: Cacheable<NoteInput> = {
      value: { entityId: 'entity-1', title: 'Draft Title', content: '<p>Draft</p>' },
      expiresAfter: Date.now() + 100000,
    };
    render(<NoteItem {...defaultProps} draft={draft} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('renders both edit and remove buttons when both are permitted', () => {
    render(<NoteItem {...defaultProps} canEdit={true} canRemove={true} />);
    expect(screen.getByLabelText(`Edit note titled ${baseNote.title}`)).toBeInTheDocument();
    expect(screen.getByLabelText(`Remove note titled ${baseNote.title}`)).toBeInTheDocument();
  });
});
