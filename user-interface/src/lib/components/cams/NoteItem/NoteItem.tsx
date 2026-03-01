import { formatDateTime } from '@/lib/utils/datetime';
import React from 'react';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Icon from '@/lib/components/uswds/Icon';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Actions, { Action } from '@common/cams/actions';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Cacheable } from '@/lib/utils/local-cache';
import PrerenderedHtml from '@/lib/components/cams/PrerenderedHtml/PrerenderedHtml';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

type NoteLayout = 'case-note' | 'trustee-note';

export interface BaseNote {
  id?: string;
  title: string;
  content: string;
  updatedOn: string;
  updatedBy: { name: string };
  previousVersionId?: string;
}
// TODO: fix spacing in case notes between title and date
export interface NoteItemConfig<TNote extends BaseNote, TInput> {
  note: TNote;
  idx: number;
  layout: NoteLayout;
  draft: Cacheable<TInput> | null;
  editAction: Action;
  removeAction: Action;
  modalId: string;
  removeModalId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modalRef: React.RefObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeModalRef: React.RefObject<any>;
  editButtonRef: React.RefObject<OpenModalButtonRef | null> | undefined;
  removeButtonRef: React.RefObject<OpenModalButtonRef | null>;
  editButtonProps: Record<string, unknown>;
  removeButtonProps: Record<string, unknown>;
  getDraftAlertMessage: (draft: Cacheable<TInput>) => string;
}

export function NoteItem<TNote extends BaseNote, TInput>(config: NoteItemConfig<TNote, TInput>) {
  const {
    note,
    idx,
    layout,
    draft,
    editAction,
    removeAction,
    modalId,
    removeModalId,
    modalRef,
    removeModalRef,
    editButtonRef,
    removeButtonRef,
    editButtonProps,
    removeButtonProps,
    getDraftAlertMessage,
  } = config;

  const prefix = layout === 'case-note' ? 'case-note' : 'trustee-note';
  const useIconLabel = layout === 'trustee-note';

  return (
    <li className={`${prefix} grid-container`} data-testid={`${prefix}-${idx}`}>
      <div className="grid-row">
        <div className="grid-col-10">
          <div className="text-wrapper">
            <h4
              className={`${prefix}-header usa-tooltip`}
              data-testid={`${prefix}-${idx}-header`}
              aria-label={`Note Title: ${note.title}`}
            >
              {note.title}
            </h4>
          </div>
        </div>

        <div
          className={`grid-col-2 ${prefix}-toolbar text-right`}
          data-testid={`${prefix}-toolbar-${idx}`}
        >
          {Actions.contains(note, editAction) && (
            <OpenModalButton
              className="edit-button"
              id={`${prefix}-edit-button`}
              buttonIndex={`${idx}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              modalId={modalId}
              modalRef={modalRef}
              ref={editButtonRef}
              data-noteid={note.id}
              openProps={editButtonProps}
              ariaLabel={`Edit note titled ${note.title}`}
            >
              {useIconLabel ? (
                <IconLabel icon="edit" label="Edit"></IconLabel>
              ) : (
                <>
                  <Icon name="edit" className="edit-icon" />
                  Edit
                </>
              )}
            </OpenModalButton>
          )}
          {Actions.contains(note, removeAction) && (
            <OpenModalButton
              className="remove-button text-secondary-dark"
              id={`${prefix}-remove-button`}
              buttonIndex={`${idx}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              modalId={removeModalId}
              modalRef={removeModalRef}
              ref={removeButtonRef}
              openProps={removeButtonProps}
              ariaLabel={`Remove note titled ${note.title}`}
            >
              {useIconLabel ? (
                <IconLabel icon="delete" label="Delete"></IconLabel>
              ) : (
                <>
                  <Icon name="remove_circle" className="remove-icon" />
                  Delete
                </>
              )}
            </OpenModalButton>
          )}
        </div>
      </div>
      <div className="grid-row trustee-note-metadata">
        <div
          className={`${prefix}-date grid-col-12 text-italic text-wrapper`}
          data-testid={`${prefix}-creation-date-${idx}`}
        >
          {note.previousVersionId ? 'Edited by: ' : 'Created by: '}
          {note.updatedBy.name}
          {' on '}
          {formatDateTime(note.updatedOn)}
        </div>
      </div>
      <div className="grid-row">
        <div className={`grid-col-12 ${prefix}-content text-wrapper`}>
          <div
            data-testid={`${prefix}-${idx}-text`}
            aria-label={`full text of ${layout}`}
            role="note"
          >
            <PrerenderedHtml htmlString={note.content} />
          </div>
        </div>
      </div>
      {draft && (
        <div className="grid-row">
          <Alert
            id={`draft-edit-${prefix}-${note.id}`}
            message={getDraftAlertMessage(draft)}
            type={UswdsAlertStyle.Info}
            role={'status'}
            timeout={0}
            show={true}
            inline={true}
            slim={true}
            className="grid-col-8"
          />
          <div className="grid-col-4"></div>
        </div>
      )}
    </li>
  );
}
