import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToggleModalButton } from './ToggleModalButton';
import Modal, { ModalRefType } from './Modal';

describe('Test Modal component', () => {
  const modalId = 'assign-attorney-modal';
  beforeEach(() => {
    const modalRef = React.createRef<ModalRefType>();
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
  });

  test('should open modal', async () => {
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

  test('should close modal when we press the `esc` key', async () => {
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(button);
    });

    expect(modal).toHaveClass('is-visible');

    act(() => {
      fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });
    });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');
  });

  test('should close modal when we click on the X', async () => {
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(button);
    });

    expect(modal).toHaveClass('is-visible');

    const closeButton = screen.getByTestId(`modal-x-button-${modalId}`);
    act(() => {
      fireEvent.click(closeButton);
    });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');
  });
});
