import { act, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssignAttorneyModal from './AssignAttorneyModal';
import React from 'react';
import { Chapter15Type } from '@/type-declarations/chapter-15';
import { ToggleModalButton } from './uswds/modal/ToggleModalButton';
import Api from '@/models/api';
import { Attorney } from '@/type-declarations/attorneys';
import { ModalRefType } from './uswds/modal/modal-refs';
import * as FeatureFlags from '@/hooks/UseFeatureFlags';

describe('Test Assign Attorney Modal Component', () => {
  let susan: Attorney;
  let mark: Attorney;
  let shara: Attorney;
  let brian: Attorney;
  let joe: Attorney;
  let bob: Attorney;
  let frank: Attorney;
  let sally: Attorney;
  let may: Attorney;
  let mobnext: Attorney;
  let attorneyList: Attorney[] = [];

  beforeEach(() => {
    susan = new Attorney('Susan', 'Arbeit', 'Manhattan');
    mark = new Attorney('Mark', 'Bruh', 'Manhattan');
    shara = new Attorney('Shara', 'Cornell', 'Manhattan');
    brian = new Attorney('Brian', 'Masumoto', 'Manhattan', { middleName: 'S' });
    joe = new Attorney('Joe', 'Cornell', 'Manhattan');
    bob = new Attorney('Bob', 'Cornell', 'Manhattan');
    frank = new Attorney('Frank', 'Cornell', 'Manhattan');
    sally = new Attorney('Sally', 'Cornell', 'Manhattan');
    may = new Attorney('May', 'Cornell', 'Manhattan');
    mobnext = new Attorney('Mobnext', 'Cornell', 'Manhattan');
    attorneyList = [susan, mark, shara, brian, joe, bob, frank, sally, may, mobnext];
  });

  test('Should open modal with submit disabled, and enable button when item is checked, and disable when there are no more items checked.', async () => {
    const bCase: Chapter15Type = {
      caseId: '123',
      caseTitle: 'Test Case',
      dateFiled: '01/01/2024',
    };

    const modalRef = React.createRef<ModalRefType>();
    const callback = vi.fn();
    const modalId = 'some-modal-id';
    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <ToggleModalButton toggleAction={'open'} modalId={modalId} modalRef={modalRef}>
              Open Modal
            </ToggleModalButton>
            <AssignAttorneyModal
              ref={modalRef}
              attorneyList={attorneyList}
              bCase={bCase}
              modalId={modalId}
              openerId="opener-123"
              callBack={callback}
            ></AssignAttorneyModal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
    const button = screen.getByTestId('toggle-modal-button');
    const modal = screen.getByTestId(`modal-${modalId}`);
    const submitButton = screen.getByTestId('toggle-modal-button-submit');

    act(() => {
      fireEvent.click(button);
    });

    expect(modal).toHaveClass('is-visible');
    expect(submitButton).toBeDisabled();

    const checkbox1 = screen.getByTestId('checkbox-1-checkbox');
    const checkbox2 = screen.getByTestId('checkbox-2-checkbox');

    act(() => {
      fireEvent.click(checkbox1);
    });

    expect(checkbox1).toBeChecked();
    expect(submitButton).toBeEnabled();

    act(() => {
      fireEvent.click(checkbox2);
    });

    expect(submitButton).toBeEnabled();

    act(() => {
      fireEvent.click(checkbox1);
    });

    expect(checkbox1).not.toBeChecked();
    expect(submitButton).toBeEnabled();

    act(() => {
      fireEvent.click(checkbox2);
    });

    expect(checkbox2).not.toBeChecked();
    expect(submitButton).toBeDisabled();
  });

  test('Should call POST with list of attorneys when assign button is clicked.', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const postSpy = vi.spyOn(Api, 'post').mockImplementation((_path, _body) => {
      return Promise.resolve({
        message: 'post mock',
        count: 0,
        body: {},
      });
    });
    const callback = vi.fn();

    const bCase: Chapter15Type = {
      caseId: '123',
      caseTitle: 'Test Case',
      dateFiled: '01/01/2024',
    };
    const modalRef = React.createRef<ModalRefType>();

    const modalId = 'some-modal-id';
    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <ToggleModalButton toggleAction={'open'} modalId={modalId} modalRef={modalRef}>
              Open Modal
            </ToggleModalButton>
            <AssignAttorneyModal
              ref={modalRef}
              attorneyList={attorneyList}
              bCase={bCase}
              modalId={modalId}
              openerId="opener-123"
              callBack={callback}
            ></AssignAttorneyModal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
    const button = screen.getByTestId('toggle-modal-button');
    const modal = screen.getByTestId(`modal-${modalId}`);

    const submitButton = screen.getByTestId('toggle-modal-button-submit');
    act(() => {
      fireEvent.click(button);
    });

    expect(modal).toHaveClass('is-visible');
    const checkbox1 = screen.getByTestId('checkbox-1-checkbox');
    const checkbox2 = screen.getByTestId('checkbox-2-checkbox');

    const checkbox3 = screen.getByTestId('checkbox-3-checkbox');
    act(() => {
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);
      fireEvent.click(checkbox3);
    });

    act(() => {
      fireEvent.click(submitButton);
    });
    expect(postSpy).toHaveBeenCalledWith(
      '/case-assignments',
      expect.objectContaining({
        attorneyList: expect.arrayContaining([
          mark.getFullName(),
          shara.getFullName(),
          brian.getFullName(),
        ]),
        caseId: '123',
        role: 'TrialAttorney',
      }),
    );
  });

  describe('Feature flag chapter-twelve-enabled', () => {
    const bCase: Chapter15Type = {
      caseId: '123',
      caseTitle: 'Test Case',
      dateFiled: '01/01/2024',
    };
    const modalRef = React.createRef<ModalRefType>();
    const modalId = 'some-modal-id';
    const caseLoadLabelTestId = 'case-load-label';
    const caseLoadTableHeaderTestId = 'case-load-table-header';

    test('should display appropriate text when true', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'chapter-twelve-enabled': true });

      render(
        <React.StrictMode>
          <BrowserRouter>
            <>
              <ToggleModalButton toggleAction={'open'} modalId={modalId} modalRef={modalRef}>
                Open Modal
              </ToggleModalButton>
              <AssignAttorneyModal
                ref={modalRef}
                attorneyList={attorneyList}
                bCase={bCase}
                modalId={modalId}
                openerId="opener-123"
                callBack={() => {
                  return;
                }}
              ></AssignAttorneyModal>
            </>
          </BrowserRouter>
        </React.StrictMode>,
      );
      const button = screen.getByTestId('toggle-modal-button');
      const modal = screen.getByTestId(`modal-${modalId}`);

      act(() => {
        fireEvent.click(button);
      });

      const expectedLabel = 'Case Load';

      expect(modal).toHaveClass('is-visible');
      const caseLoadLabel = screen.getByTestId(caseLoadLabelTestId);
      expect(caseLoadLabel).toBeInTheDocument();
      expect(caseLoadLabel.innerHTML).toEqual(expectedLabel);

      const caseLoadTableLabel = screen.getByTestId(caseLoadTableHeaderTestId);
      expect(caseLoadTableLabel).toBeInTheDocument();
      expect(caseLoadTableLabel.innerHTML).toEqual(expectedLabel);
    });

    test('should display appropriate text when false', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'chapter-twelve-enabled': false });
      render(
        <React.StrictMode>
          <BrowserRouter>
            <>
              <ToggleModalButton toggleAction={'open'} modalId={modalId} modalRef={modalRef}>
                Open Modal
              </ToggleModalButton>
              <AssignAttorneyModal
                ref={modalRef}
                attorneyList={attorneyList}
                bCase={bCase}
                modalId={modalId}
                openerId="opener-123"
                callBack={() => {
                  return;
                }}
              ></AssignAttorneyModal>
            </>
          </BrowserRouter>
        </React.StrictMode>,
      );
      const button = screen.getByTestId('toggle-modal-button');
      const modal = screen.getByTestId(`modal-${modalId}`);

      act(() => {
        fireEvent.click(button);
      });

      const expectedLabel = 'Chapter 15 Cases';

      expect(modal).toHaveClass('is-visible');
      const caseLoadLabel = screen.getByTestId(caseLoadLabelTestId);
      expect(caseLoadLabel).toBeInTheDocument();
      expect(caseLoadLabel.innerHTML).toEqual(expectedLabel);

      const caseLoadTableLabel = screen.getByTestId(caseLoadTableHeaderTestId);
      expect(caseLoadTableLabel).toBeInTheDocument();
      expect(caseLoadTableLabel.innerHTML).toEqual(expectedLabel);
    });
  });
});
