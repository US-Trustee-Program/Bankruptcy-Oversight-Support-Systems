import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToggleModalButton } from './ToggleModalButton';
import Modal from './Modal';

describe('Test Modal component', () => {
  test('should open modal', async () => {
    const modalId = 'modal123';
    const actionButtonGroup = {
      modalId: modalId,
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
            <ToggleModalButton data-testid="toggle-button" toggleAction={'open'} modalId={modalId}>
              Open Modal
            </ToggleModalButton>
            <Modal
              data-testid="modal"
              modalId={modalId}
              heading={'Test Heading'}
              content={'Test Content'}
              actionButtonGroup={actionButtonGroup}
            ></Modal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );

    // click button
    const button = screen.getByTestId('toggle-button');
    const modal = screen.getByTestId('modal');
    button.click();
    expect(modal.ariaDisabled).toBeFalsy();
    // add test for isVisible classname
  });
});
