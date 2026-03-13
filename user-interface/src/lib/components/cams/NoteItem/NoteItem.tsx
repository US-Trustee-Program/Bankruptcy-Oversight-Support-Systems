import { formatDateTime } from '@/lib/utils/datetime';
import React from 'react';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Cacheable } from '@/lib/utils/local-cache';
import PrerenderedHtml from '@/lib/components/cams/PrerenderedHtml/PrerenderedHtml';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { NoteInput } from '../Notes/types';

interface BaseNote {
  id?: string;
  title: string;
  content: string;
  updatedOn: string;
  updatedBy: { name: string };
  previousVersionId?: string;
}

// Simplified props with explicit parameters instead of config object
interface NoteItemProps {
  note: BaseNote;
  index: number;
  draft: Cacheable<NoteInput> | null;
  canEdit: boolean;
  canRemove: boolean;
  modalId: string;
  removeModalId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modalRef: React.RefObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeModalRef: React.RefObject<any>;
  editButtonRef?: React.RefObject<OpenModalButtonRef | null>;
  removeButtonRef?: React.RefObject<OpenModalButtonRef | null>;
  editButtonProps: Record<string, unknown>;
  removeButtonProps: Record<string, unknown>;
  getDraftAlertMessage: (draft: Cacheable<NoteInput>) => string;
}

export function NoteItem({
  note,
  index,
  draft,
  canEdit,
  canRemove,
  modalId,
  removeModalId,
  modalRef,
  removeModalRef,
  editButtonRef,
  removeButtonRef,
  editButtonProps,
  removeButtonProps,
  getDraftAlertMessage,
}: NoteItemProps) {
  return (
    <div role="listitem" className={`note-item grid-container`} data-testid={`note-item-${index}`}>
      <div className="grid-row">
        <div className="grid-col-10">
          <div className="text-wrapper">
            <h4
              className={`note-item-header usa-tooltip`}
              data-testid={`note-item-${index}-header`}
              aria-label={`Note Title: ${note.title}`}
            >
              {note.title}
            </h4>
          </div>
        </div>

        <div
          className={`grid-col-2 note-item-toolbar text-right`}
          data-testid={`note-item-toolbar-${index}`}
        >
          {canEdit && (
            <OpenModalButton
              className="edit-button"
              id={`note-item-edit-button`}
              buttonIndex={`${index}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              modalId={modalId}
              modalRef={modalRef}
              ref={editButtonRef}
              data-noteid={note.id}
              openProps={editButtonProps}
              ariaLabel={`Edit note titled ${note.title}`}
            >
              <IconLabel icon="edit" label="Edit"></IconLabel>
            </OpenModalButton>
          )}
          {canRemove && (
            <OpenModalButton
              className="remove-button text-secondary"
              id={`note-item-remove-button`}
              buttonIndex={`${index}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              modalId={removeModalId}
              modalRef={removeModalRef}
              ref={removeButtonRef}
              openProps={removeButtonProps}
              ariaLabel={`Delete note titled ${note.title}`}
            >
              <IconLabel icon="delete" label="Delete"></IconLabel>
            </OpenModalButton>
          )}
        </div>
      </div>
      <div className="trustee-note-metadata">
        <div
          className={`note-item-date grid-col-12 text-italic text-wrapper`}
          data-testid={`note-item-creation-date-${index}`}
        >
          {note.previousVersionId ? 'Edited by: ' : 'Created by: '}
          {note.updatedBy.name}
          {' on '}
          {formatDateTime(note.updatedOn)}
        </div>
      </div>
      <div
        className={`note-item-content text-wrapper`}
        data-testid={`note-item-${index}-text`}
        aria-label={`full text of note`}
        role="note"
      >
        <PrerenderedHtml htmlString={note.content} />
      </div>
      {draft && (
        <Alert
          id={`draft-edit-note-item-${note.id}`}
          message={getDraftAlertMessage(draft)}
          type={UswdsAlertStyle.Info}
          role={'status'}
          timeout={0}
          show={true}
          inline={true}
          slim={true}
          className="note-item-draft-alert"
        />
      )}
    </div>
  );
}
