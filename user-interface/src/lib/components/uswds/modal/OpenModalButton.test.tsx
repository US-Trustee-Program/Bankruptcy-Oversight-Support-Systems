import { act, render, waitFor } from '@testing-library/react';
import OpenModalButton from './OpenModalButton';
import React from 'react';
import { OpenModalButtonRef } from './modal-refs';

import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('Toggle Modal Button tests', () => {
  const modalId = 'test-modal';
  let button: HTMLButtonElement | null;
  const buttonClick = vi.fn();
  const modalRefMock = {
    current: {
      show: vi.fn(),
      hide: vi.fn(),
      buttons: {
        current: {
          disableSubmitButton: vi.fn(),
        },
      },
    },
  };
  let openButtonRef: React.RefObject<OpenModalButtonRef | null>;
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  const renderWithoutProps = () => {
    openButtonRef = React.createRef<OpenModalButtonRef>();
    render(
      <OpenModalButton
        buttonIndex="open-test"
        modalId={modalId}
        modalRef={modalRefMock}
        onClick={buttonClick}
        ref={openButtonRef}
      >
        Open Modal
      </OpenModalButton>,
    );
    button = document.querySelector('.usa-button');
  };

  test('calling ref.disable should disable button', async () => {
    renderWithoutProps();
    await waitFor(() => {
      expect(button).not.toHaveAttribute('disabled');
    });

    act(() => openButtonRef?.current?.disableButton(true));

    await waitFor(() => {
      expect(button).toHaveAttribute('disabled');
    });
  });

  test('should focus on button when ref.focus is called', async () => {
    renderWithoutProps();
    await waitFor(() => {
      expect(document.activeElement).toBe(document.body);
    });

    act(() => openButtonRef?.current?.focus());

    await waitFor(() => {
      expect(document.activeElement).toBe(button);
    });
  });

  test('should call onClick callback when button is clicked', async () => {
    renderWithoutProps();
    await userEvent.click(button!);

    await waitFor(() => expect(buttonClick).toHaveBeenCalled());
  });
});
