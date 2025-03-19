import Api2 from '@/lib/models/api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseNoteRemovalModal, { CaseNoteRemovalProps } from './CaseNoteRemovalModal';
import { randomUUID } from 'crypto';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import CaseNoteRemovalModal from './CaseNoteRemovalModal';

const caseId = '000-11-22222';
const userId = '001';
const userFullName = 'Joe Bob';
const caseNotes = [
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
  MockData.getCaseNote({ caseId }),
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
];
const modalId = 'removal-modal';
const modalOpenButtonRef = React.createRef<OpenModalButtonRef>();

function renderWithProps(
  modalRef: React.RefObject<CaseNoteRemovalModalRef>,
  openProps?: Partial<CaseNoteRemovalModalOpenProps>,
  props?: Partial<CaseNoteRemovalProps>,
) {
  const defaultProps: CaseNoteRemovalProps = {
    id: randomUUID(),
    caseId: '000-11-22222',
    onUpdateNoteRequest: vi.fn(),
    ...props,
  };
  const modalOpenDefaultProps: CaseNoteRemovalModalOpenProps = {
    id: randomUUID(),
    caseId: '000-11-22222',
    onUpdateNoteRequest: vi.fn(),
    ...openProps,
  };
  const renderProps = { ...defaultProps, ...modalOpenDefaultProps, ...props };
  render(
    <React.StrictMode>
      <BrowserRouter>
        <>
          <OpenModalButton
            modalId={modalId}
            modalRef={modalRef}
            openProps={openRenderProps}
            ref={modalOpenButtonRef}
          >
            Open Modal
          </OpenModalButton>
          <CaseNoteRemovalModal {...renderProps} />
        </>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

describe('Case Note Removal Modal Tests', async () => {
  test('should remove case note when remove button is clicked and modal approval is met.', async () => {
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    const deleteSpy = vi
      .spyOn(Api2, 'deleteCaseNote')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error());
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    const expectedUser = {
      id: userId,
      name: userFullName,
    };
    const expectedFirstRemoveArgument = {
      id: caseNotes[0].id,
      caseId: caseNotes[0].caseId,
      updatedBy: expectedUser,
    };
    const expectedSecondRemoveArgument = {
      id: caseNotes[2].id,
      caseId: caseNotes[2].caseId,
      updatedBy: expectedUser,
    };
    const onNoteRemoveSpy = vi.fn();

    renderWithProps({
      caseId,
      onUpdateNoteRequest: onNoteRemoveSpy,
    });

    const button0 = screen.queryByTestId('open-modal-button_case-note-remove-button_0');
    const button1 = screen.queryByTestId('open-modal-button_case-note-remove-button_1');
    const button2 = screen.queryByTestId('open-modal-button_case-note-remove-button_2');

    await waitFor(() => {
      expect(button0).toBeInTheDocument();
    });
    expect(button1).not.toBeInTheDocument();
    expect(button2).toBeInTheDocument();

    await userEvent.click(button0!);
    const modalSubmitButton0 = screen.queryByTestId('button-remove-note-modal-submit-button');
    await waitFor(() => {
      expect(modalSubmitButton0).toBeVisible();
    });
    await userEvent.click(modalSubmitButton0!);
    expect(deleteSpy).toHaveBeenCalledWith(expectedFirstRemoveArgument);
    expect(onNoteRemoveSpy).toHaveBeenCalled();

    await userEvent.click(button2!);
    const modalSubmitButton2 = screen.queryByTestId('button-remove-note-modal-submit-button');
    await waitFor(() => {
      expect(modalSubmitButton2).toBeVisible();
    });
    await userEvent.click(modalSubmitButton2!);
    expect(deleteSpy).toHaveBeenCalledWith(expectedSecondRemoveArgument);
    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('There was a problem archiving the note.');
    });
    expect(onNoteRemoveSpy).toHaveBeenCalledTimes(1);
  });
});
