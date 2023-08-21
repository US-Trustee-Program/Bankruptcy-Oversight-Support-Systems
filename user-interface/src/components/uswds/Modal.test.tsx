import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToggleModalButton } from './ToggleModalButton';
import Modal, { ModalRefType } from './Modal';

describe('Test Modal component', () => {
  test('should open modal', async () => {
    const modalRef = React.createRef<ModalRefType>();
    const modalId = 'assign-attorney-modal';
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
      cancelButton: {
        label: 'Cancel',
      },
    };

    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <ToggleModalButton
              buttonId="open-test"
              toggleAction={'open'}
              modalId={modalId}
              modalRef={modalRef}
            >
              Open Modal
            </ToggleModalButton>
            <Modal
              modalId={modalId}
              ref={modalRef}
              heading={'Test Heading'}
              content={'Test Content'}
              actionButtonGroup={actionButtonGroup}
            ></Modal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );

    // click button
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(button);
    });

    // add test for isVisible classname
    expect(modal).toHaveClass('is-visible');
    expect(modal).not.toHaveClass('is-hidden');
  });
});
