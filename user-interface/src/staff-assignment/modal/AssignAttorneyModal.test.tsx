import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssignAttorneyModal, {
  AssignAttorneyModalProps,
  AssignAttorneyModalRef,
} from './AssignAttorneyModal';
import React from 'react';
import Api from '@/lib/models/api';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { CaseBasics } from '@common/cams/cases';
import { getCamsUserReference } from '@common/cams/session';
import { MANHATTAN } from '@common/cams/test-utilities/offices.mock';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';

const offices = [MANHATTAN!];
const susan = MockData.getAttorneyUser({ name: 'Susan Arbeit', offices });
const mark = MockData.getAttorneyUser({ name: 'Mark Bruh', offices });
const shara = MockData.getAttorneyUser({ name: 'Shara Cornell', offices });
const brian = MockData.getAttorneyUser({ name: 'Brian Masumoto', offices });
const joe = MockData.getAttorneyUser({ name: 'Joe Cornell', offices });
const bob = MockData.getAttorneyUser({ name: 'Bob Cornell', offices });
const frank = MockData.getAttorneyUser({ name: 'Frank Cornell', offices });
const sally = MockData.getAttorneyUser({ name: 'Sally Cornell', offices });
const may = MockData.getAttorneyUser({ name: 'May Cornell', offices });
const mobnext = MockData.getAttorneyUser({ name: 'Mobnext Cornell', offices });
const attorneyList = [susan, mark, shara, brian, joe, bob, frank, sally, may, mobnext];

const modalId = 'some-modal-id';

describe('Test Assign Attorney Modal Component', () => {
  function renderWithProps(
    modalRef: React.RefObject<AssignAttorneyModalRef>,
    props: Partial<AssignAttorneyModalProps> = {},
  ) {
    const defaults: AssignAttorneyModalProps = {
      attorneyList,
      modalId,
      callBack: vi.fn(),
    };

    const propsToRender: AssignAttorneyModalProps = {
      ...defaults,
      ...props,
    };

    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <ToggleModalButton
              toggleAction={'open'}
              modalId={propsToRender.modalId}
              modalRef={modalRef}
            >
              Open Modal
            </ToggleModalButton>
            <AssignAttorneyModal {...propsToRender} ref={modalRef}></AssignAttorneyModal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  test('Should enable the submit button if changes are selected, otherwise disabled if no change.', async () => {
    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef);

    const bCase: CaseBasics = MockData.getCaseBasics({
      override: {
        caseId: '123',
        caseTitle: 'Test Case',
        dateFiled: '2024-01-01',
      },
    });
    bCase.assignments = [];

    modalRef.current?.show({
      bCase,
    });
    const button = screen.getByTestId('toggle-modal-button');
    const modal = screen.getByTestId(`modal-${modalId}`);
    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);

    fireEvent.click(button);

    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
      expect(submitButton).toBeDisabled();
    });

    const checkbox1 = screen.getByTestId('checkbox-1-checkbox');
    const checkbox2 = screen.getByTestId('checkbox-2-checkbox');

    fireEvent.click(checkbox1);

    await waitFor(() => {
      expect(checkbox1).toBeChecked();
      expect(submitButton).toBeEnabled();
    });

    fireEvent.click(checkbox2);

    await waitFor(() => {
      expect(checkbox2).toBeChecked();
      expect(submitButton).toBeEnabled();
    });

    fireEvent.click(checkbox1);

    await waitFor(() => {
      expect(checkbox1).not.toBeChecked();
      expect(submitButton).toBeEnabled();
    });

    fireEvent.click(checkbox2);

    await waitFor(() => {
      expect(checkbox2).not.toBeChecked();
      expect(submitButton).toBeDisabled();
    });
  });

  test('Should call POST with list of attorneys when assign button is clicked.', async () => {
    const postSpy = vi.spyOn(Api, 'post').mockImplementation((_path, _body) => {
      return Promise.resolve({
        message: 'post mock',
        count: 0,
        body: {},
      });
    });
    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef);

    modalRef.current?.show({
      bCase: MockData.getCaseBasics({
        override: {
          caseId: '123',
          caseTitle: 'Test Case',
          dateFiled: '2024-01-01',
        },
      }),
    });
    const button = screen.getByTestId('toggle-modal-button');
    const modal = screen.getByTestId(`modal-${modalId}`);

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    fireEvent.click(button);

    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });

    const checkbox1 = screen.getByTestId('checkbox-1-checkbox');
    const checkbox2 = screen.getByTestId('checkbox-2-checkbox');
    const checkbox3 = screen.getByTestId('checkbox-3-checkbox');

    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);
    fireEvent.click(checkbox3);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/case-assignments',
        expect.objectContaining({
          attorneyList: expect.arrayContaining([
            getCamsUserReference(mark),
            getCamsUserReference(shara),
            getCamsUserReference(brian),
          ]),
          caseId: '123',
          role: 'TrialAttorney',
        }),
      );
    });
  });

  test('should show and hide from the imperative api', async () => {
    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef);

    modalRef.current?.show({
      bCase: MockData.getCaseBasics({
        override: {
          caseId: '123',
          caseTitle: 'Test Case',
          dateFiled: '2024-01-01',
        },
      }),
    });

    const modal = screen.getByTestId(`modal-${modalId}`);
    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });

    modalRef.current?.hide();
    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
  });

  test('should call callback with error information if API caseAssignments POST returns error', async () => {
    const error = new Error('API Rejection');
    vi.spyOn(Api, 'post').mockRejectedValue(error);
    const callBack = vi.fn();

    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef, { callBack });

    modalRef.current?.show({
      bCase: MockData.getCaseBasics({
        override: {
          caseId: '123',
          caseTitle: 'Test Case',
          dateFiled: '2024-01-01',
        },
      }),
    });
    const modal = screen.getByTestId(`modal-${modalId}`);

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);

    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });

    const checkbox1 = screen.getByTestId('checkbox-1-checkbox');
    const checkbox2 = screen.getByTestId('checkbox-2-checkbox');
    const checkbox3 = screen.getByTestId('checkbox-3-checkbox');

    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);
    fireEvent.click(checkbox3);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(callBack).toHaveBeenCalledWith(
        expect.objectContaining({
          apiResult: error,
          status: 'error',
        }),
      );
    });
  });
});
