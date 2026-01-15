import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { render, screen, waitFor } from '@testing-library/react';
import {
  CaseNoteRemovalModalOpenProps,
  CaseNoteRemovalModalRef,
  CaseNoteRemovalProps,
} from './CaseNoteRemovalModal';
import { randomUUID } from 'crypto';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import CaseNoteRemovalModal from './CaseNoteRemovalModal';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { buildCaseNoteFormKey } from './CaseNoteFormModal';

const caseId = '000-11-22222';
const userId = '001';
const userFullName = 'Joe Bob';
const caseNotes = [
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
  MockData.getCaseNote({ caseId }),
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
];
const openModalButtonRef = React.createRef<OpenModalButtonRef>();

function renderWithProps(
  modalRef: React.RefObject<CaseNoteRemovalModalRef | null>,
  openProps?: Partial<CaseNoteRemovalModalOpenProps>,
  props?: Partial<CaseNoteRemovalProps>,
) {
  const defaultProps: CaseNoteRemovalProps = {
    modalId: 'remove-note-modal',
    ...props,
  };

  const modalOpenDefaultProps: CaseNoteRemovalModalOpenProps = {
    id: randomUUID(),
    caseId: '000-11-22222',
    buttonId: `case-note-remove-button`,
    callback: vi.fn(),
    openModalButtonRef,
    ...openProps,
  };

  const renderProps = { ...defaultProps, ...props };
  const openRenderProps = { ...modalOpenDefaultProps, ...openProps };

  render(
    <React.StrictMode>
      <BrowserRouter>
        <>
          <OpenModalButton
            modalId={renderProps.modalId}
            modalRef={modalRef}
            openProps={openRenderProps}
            ref={openModalButtonRef}
          >
            Open Modal
          </OpenModalButton>
          <CaseNoteRemovalModal {...renderProps} ref={modalRef} />
        </>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

describe('Case Note Removal Modal Tests', async () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('should remove case note when remove button is clicked and modal approval is met.', async () => {
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    const deleteSpy = vi.spyOn(Api2, 'deleteCaseNote').mockResolvedValue();

    const modalRef = React.createRef<CaseNoteRemovalModalRef>();
    const expectedUser = {
      id: userId,
      name: userFullName,
    };
    const expectedRemovalArgument = {
      id: caseNotes[0].id,
      caseId: caseNotes[0].caseId,
      updatedBy: expectedUser,
    };
    const callbackSpy = vi.fn();

    const openProps: Partial<CaseNoteRemovalModalOpenProps> = {
      id: caseNotes[0].id,
      callback: callbackSpy,
    };

    renderWithProps(modalRef, openProps);

    const openModalButton = screen.queryByTestId('open-modal-button');

    await waitFor(() => {
      expect(openModalButton).toBeInTheDocument();
    });

    await userEvent.click(openModalButton!);
    const modalSubmitButton = screen.queryByTestId('button-remove-note-modal-submit-button');
    await waitFor(() => {
      expect(modalSubmitButton).toBeVisible();
    });
    await userEvent.click(modalSubmitButton!);
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(expectedRemovalArgument);
    });
    expect(callbackSpy).toHaveBeenCalled();
  });

  test('should not call delete when cancel button is clicked', async () => {
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    const deleteSpy = vi
      .spyOn(Api2, 'deleteCaseNote')
      .mockRejectedValue(new Error('This should not be called.'));

    const modalRef = React.createRef<CaseNoteRemovalModalRef>();
    const callbackSpy = vi.fn();

    const openProps: Partial<CaseNoteRemovalModalOpenProps> = {
      id: caseNotes[0].id,
      callback: callbackSpy,
    };

    renderWithProps(modalRef, openProps);

    const openModalButton = screen.queryByTestId('open-modal-button');

    await waitFor(() => {
      expect(openModalButton).toBeInTheDocument();
    });

    await userEvent.click(openModalButton!);
    let modalCancelButton = screen.queryByTestId('button-remove-note-modal-cancel-button');
    await waitFor(() => {
      expect(modalCancelButton).toBeVisible();
    });
    await userEvent.click(modalCancelButton!);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(callbackSpy).not.toHaveBeenCalled();
    modalCancelButton = screen.queryByTestId('button-remove-note-modal-cancel-button');
  });

  test('should close the modal and display a global alert for api error', async () => {
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    const deleteSpy = vi
      .spyOn(Api2, 'deleteCaseNote')
      .mockRejectedValue(new Error('some unknown error'));
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    const modalRef = React.createRef<CaseNoteRemovalModalRef>();
    const expectedUser = {
      id: userId,
      name: userFullName,
    };
    const expectedRemovalArgument = {
      id: caseNotes[0].id,
      caseId: caseNotes[0].caseId,
      updatedBy: expectedUser,
    };
    const callbackSpy = vi.fn();

    const openProps: Partial<CaseNoteRemovalModalOpenProps> = {
      id: caseNotes[0].id,
      callback: callbackSpy,
    };

    renderWithProps(modalRef, openProps);

    const openModalButton = screen.queryByTestId('open-modal-button');
    await waitFor(() => {
      expect(openModalButton).toBeInTheDocument();
    });

    await userEvent.click(openModalButton!);
    const modal = screen.queryByTestId('modal-remove-note-modal');
    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });
    const modalSubmitButton = screen.queryByTestId('button-remove-note-modal-submit-button');
    await waitFor(() => {
      expect(modalSubmitButton).toBeVisible();
    });
    await userEvent.click(modalSubmitButton!);
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(expectedRemovalArgument);
    });
    expect(callbackSpy).not.toHaveBeenCalled();
    expect(modal).toHaveClass('is-hidden');
    expect(globalAlertSpy.error).toHaveBeenCalledWith(
      'There was a problem removing the case note.',
    );
  });

  test('should delete associated draft when case note is removed', async () => {
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    vi.spyOn(Api2, 'deleteCaseNote').mockResolvedValue();
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');

    const modalRef = React.createRef<CaseNoteRemovalModalRef>();
    const callbackSpy = vi.fn();
    const noteId = caseNotes[0].id!;
    const noteCaseId = caseNotes[0].caseId;

    const openProps: Partial<CaseNoteRemovalModalOpenProps> = {
      id: noteId,
      caseId: noteCaseId,
      callback: callbackSpy,
    };

    renderWithProps(modalRef, openProps);

    const openModalButton = screen.queryByTestId('open-modal-button');
    await waitFor(() => {
      expect(openModalButton).toBeInTheDocument();
    });

    await userEvent.click(openModalButton!);
    const modalSubmitButton = screen.queryByTestId('button-remove-note-modal-submit-button');
    await waitFor(() => {
      expect(modalSubmitButton).toBeVisible();
    });
    await userEvent.click(modalSubmitButton!);

    const expectedDraftKey = buildCaseNoteFormKey(noteCaseId, 'edit', noteId);
    await waitFor(() => {
      expect(clearFormSpy).toHaveBeenCalledWith(expectedDraftKey);
    });
    expect(callbackSpy).toHaveBeenCalled();
  });

  test('should expose hide function on modal ref', async () => {
    const modalRef = React.createRef<CaseNoteRemovalModalRef>();
    renderWithProps(modalRef);

    await waitFor(() => {
      expect(modalRef.current).not.toBeNull();
    });

    // Verify hide function exists
    expect(modalRef.current?.hide).toBeDefined();
    expect(typeof modalRef.current?.hide).toBe('function');

    // Verify calling hide doesn't throw an error
    expect(() => {
      modalRef.current?.hide();
    }).not.toThrow();
  });
});
