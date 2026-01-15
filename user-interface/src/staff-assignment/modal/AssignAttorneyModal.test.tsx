import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AssignAttorneyModalProps, AssignAttorneyModalRef } from './assignAttorneyModal.types';
import React, { act } from 'react';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseBasics } from '@common/cams/cases';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { AttorneyUser } from '@common/cams/users';
import { ResponseBody } from '@common/api/response';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import Api2 from '@/lib/models/api2';
import { REGION_02_GROUP_NY } from '@common/cams/test-utilities/mock-user';
import AssignAttorneyModal from './AssignAttorneyModal';

const offices = [REGION_02_GROUP_NY!];
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
  let callback = vi.fn();
  let userEvent: CamsUserEvent;

  const attorneyListResponse: ResponseBody<AttorneyUser[]> = {
    meta: { self: 'self-url' },
    data: attorneyList,
  };

  function renderWithProps(
    modalRef: React.RefObject<AssignAttorneyModalRef | null>,
    props: Partial<AssignAttorneyModalProps> = {},
  ) {
    const defaults: AssignAttorneyModalProps = {
      modalId,
      assignmentChangeCallback: vi.fn(),
    };

    const propsToRender: AssignAttorneyModalProps = {
      ...defaults,
      ...props,
    };

    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <OpenModalButton modalId={propsToRender.modalId} modalRef={modalRef}>
              Open Modal
            </OpenModalButton>
            <AssignAttorneyModal {...propsToRender} ref={modalRef}></AssignAttorneyModal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  beforeEach(() => {
    vi.spyOn(Api2, 'getOfficeAttorneys').mockResolvedValue(attorneyListResponse);
    callback = vi.fn();
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    act(() =>
      modalRef.current?.show({
        bCase,
        callback,
      }),
    );

    const button = screen.getByTestId('open-modal-button');
    const modal = screen.getByTestId(`modal-${modalId}`);
    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);

    await userEvent.click(button);

    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
      expect(submitButton).toBeDisabled();
    });

    // Attorneys are sorted alphabetically: Bob, Brian, Frank, Joe, Mark, May, Mobnext, Sally, Shara, Susan
    // Selecting Brian (index 1 after sort)
    const sortedAttorneys = [...attorneyList].sort((a, b) => a.name.localeCompare(b.name));
    const checkbox1 = await TestingUtilities.selectCheckbox(
      `attorney-${sortedAttorneys[1].id}-checkbox`,
    );

    await waitFor(() => {
      expect(checkbox1).toBeChecked();
      expect(submitButton).toBeEnabled();
    });

    const checkbox2 = await TestingUtilities.selectCheckbox(
      `attorney-${sortedAttorneys[2].id}-checkbox`,
    );

    await waitFor(() => {
      expect(checkbox2).toBeChecked();
      expect(submitButton).toBeEnabled();
    });

    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[1].id}-checkbox`);

    await waitFor(() => {
      expect(checkbox1).not.toBeChecked();
      expect(submitButton).toBeEnabled();
    });

    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[2].id}-checkbox`);

    await waitFor(() => {
      expect(checkbox2).not.toBeChecked();
      expect(submitButton).toBeDisabled();
    });
  });

  test('Should call POST with list of attorneys when assign button is clicked and call callback with expected data.', async () => {
    const assignmentChangeCallback = vi.fn();
    const postSpy = vi.spyOn(Api2, 'postStaffAssignments').mockResolvedValue({
      data: undefined,
    });
    const mockCase = MockData.getCaseBasics({
      override: {
        caseId: '123',
        caseTitle: 'Test Case',
        dateFiled: '2024-01-01',
      },
    });

    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef, { assignmentChangeCallback });

    act(() =>
      modalRef.current?.show({
        callback,
        bCase: mockCase,
      }),
    );
    const button = screen.getByTestId('open-modal-button');
    const modal = screen.getByTestId(`modal-${modalId}`);

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    await userEvent.click(button);

    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });

    const sortedAttorneys = [...attorneyList].sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    });

    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[1].id}-checkbox`);
    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[2].id}-checkbox`);
    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[3].id}-checkbox`);
    await userEvent.click(submitButton);

    const expectedAttorneys = sortedAttorneys.slice(1, 4).map((attorney) => {
      return { id: attorney.id, name: attorney.name };
    });

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          attorneyList: expectedAttorneys,
          caseId: '123',
          role: 'TrialAttorney',
        }),
      );
    });

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          bCase: mockCase,
          selectedAttorneyList: expectedAttorneys,
          previouslySelectedList: [],
          status: 'success',
          apiResult: {},
        }),
      );
    });

    await waitFor(() => {
      expect(assignmentChangeCallback).toHaveBeenCalledWith(expectedAttorneys);
    });
  });

  test('should show and hide from the imperative api', async () => {
    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef);

    act(() =>
      modalRef.current?.show({
        callback,
        bCase: MockData.getCaseBasics({
          override: {
            caseId: '123',
            caseTitle: 'Test Case',
            dateFiled: '2024-01-01',
          },
        }),
      }),
    );

    const modal = screen.getByTestId(`modal-${modalId}`);
    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });

    act(() => modalRef.current?.hide());
    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
  });

  test('should call callback with error information if API caseAssignments POST returns error', async () => {
    const error = new Error('API Rejection');
    vi.spyOn(Api2, 'postStaffAssignments').mockRejectedValue(error);

    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef, {});

    act(() =>
      modalRef.current?.show({
        callback,
        bCase: MockData.getCaseBasics({
          override: {
            caseId: '123',
            caseTitle: 'Test Case',
            dateFiled: '2024-01-01',
          },
        }),
      }),
    );
    const modal = screen.getByTestId(`modal-${modalId}`);

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);

    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });

    const sortedAttorneys = [...attorneyList].sort((a, b) => a.name.localeCompare(b.name));
    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[1].id}-checkbox`);
    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[2].id}-checkbox`);
    await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[3].id}-checkbox`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          apiResult: error,
          status: 'error',
        }),
      );
    });
  });

  test('should display error alert when call to getAttorneys throws an error', async () => {
    const error = new Error('API Rejection');
    vi.spyOn(Api2, 'getOfficeAttorneys').mockRejectedValue(error);
    const alertSpy = TestingUtilities.spyOnGlobalAlert();

    const modalRef = React.createRef<AssignAttorneyModalRef>();
    renderWithProps(modalRef, {});

    act(() =>
      modalRef.current?.show({
        callback,
        bCase: MockData.getCaseBasics({
          override: {
            caseId: '123',
            caseTitle: 'Test Case',
            dateFiled: '2024-01-01',
          },
        }),
      }),
    );

    await waitFor(() => {
      expect(alertSpy.error).toHaveBeenCalled();
    });
  });
});
