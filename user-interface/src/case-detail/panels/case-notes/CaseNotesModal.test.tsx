import { randomUUID } from 'node:crypto';
import CaseNoteModal, { CaseNoteModalOpenProps, CaseNoteModalRef } from './CaseNoteModal';
import { render, screen } from '@testing-library/react';
import { CaseNotesProps } from './CaseNotes';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import userEvent from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import { CaseNoteInput } from '@common/cams/cases';

const initialTitleValue = 'Test Case Note Title';
const initialContentValue = 'Test Case Note Content';
const testCaseId = '000-11-22222';

const defaultProps: CaseNoteModalOpenProps = {
  id: randomUUID(),
  title: initialTitleValue,
  content: initialContentValue,
  caseId: testCaseId,
  callback: vi.fn(),
};

function renderWithProps(
  modalRef: React.RefObject<CaseNoteModalRef>,
  props?: Partial<CaseNotesProps>,
) {
  const modalId = 'edit-modal';

  const renderProps = { ...defaultProps, ...props };
  render(
    <React.StrictMode>
      <BrowserRouter>
        <>
          <OpenModalButton modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <CaseNoteModal {...renderProps} ref={modalRef} modalId={modalId} />
        </>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

describe('case note tests', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Should properly submit case note edit with previousVersionId present', async () => {
    //NOTE: should also be populated with old note information initially
    const modalRef = React.createRef<CaseNoteModalRef>();
    const putNoteSpy = vi.spyOn(Api2, 'putCaseNote');
    renderWithProps(modalRef);

    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';
    let titleInput;
    let contentInput;

    titleInput = screen.getByTestId('case-note-title-input');
    expect(titleInput).toHaveValue(initialTitleValue);
    contentInput = screen.getByTestId('text-area-content-input');
    expect(contentInput).toHaveValue(initialContentValue);

    await userEvent.clear(contentInput);
    contentInput = screen.getByTestId('text-area-content-input');
    expect(contentInput).toHaveValue('');

    const clearTitleButton = screen.getByTestId('clear-case-note');
    await userEvent.click(clearTitleButton);
    titleInput = screen.getByTestId('case-note-title-input');
    expect(titleInput).toHaveValue('');

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId('button-submit-case-note'));
    const expectedInput: CaseNoteInput = {
      id: defaultProps.id,
      title: editedNoteTitleText,
      content: editedNoteContentText,
      caseId: testCaseId,
    };

    expect(putNoteSpy).toHaveBeenCalledWith(expectedInput);
  });

  test('Should close when cancel is clicked', async () => {});

  test('Should properly handle when api returns an error', async () => {});
});
