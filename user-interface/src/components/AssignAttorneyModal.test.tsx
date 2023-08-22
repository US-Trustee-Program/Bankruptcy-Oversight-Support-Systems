import { act, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssignAttorneyModal, { CallBackProps } from './AssignAttorneyModal';
import React from 'react';
import { Chapter15Type } from '../type-declarations/chapter-15';
import { ModalRefType } from './uswds/Modal';
import { ToggleModalButton } from './uswds/ToggleModalButton';
import Api from '../models/api';
import MockUpdateCases from './utils/mock.update-cases';

describe('Test Assign Attorney Modal Component', () => {
  test('Should open modal with submit disabled, and enable button when item is checked, and disable when there are no more items checked.', async () => {
    const bCase: Chapter15Type = {
      caseNumber: '123',
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
    const callbackSpy = vi.spyOn(MockUpdateCases, 'mockCallback');

    const bCase: Chapter15Type = {
      caseNumber: '123',
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
              bCase={bCase}
              modalId={modalId}
              openerId="opener-123"
              callBack={MockUpdateCases.mockCallback}
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
        attorneyIdList: expect.arrayContaining(['4', '5', '6']),
        caseId: '123',
        role: 'TrialAttorney',
      }),
    );
    expect(callbackSpy).toHaveBeenCalled();
    // expect(callbackSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  //test('Should display an error, when the POST throws an error', async () => {  });
});
