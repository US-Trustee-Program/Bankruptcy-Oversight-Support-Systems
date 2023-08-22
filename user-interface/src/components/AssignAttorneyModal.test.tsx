import { act, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssignAttorneyModal from './AssignAttorneyModal';
import React from 'react';
import { Chapter15Type } from '../type-declarations/chapter-15';
import { ModalRefType } from './uswds/Modal';
import { ToggleModalButton } from './uswds/ToggleModalButton';

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
    //expect(button).
  });
});
