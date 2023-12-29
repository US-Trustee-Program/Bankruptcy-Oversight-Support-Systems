import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SubmitCancelButtonGroup } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import React from 'react';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BUTTON_BASE_CLASS, UswdsButtonStyle } from '@/lib/components/uswds/Button';

describe('Submit cancel button group tests', () => {
  test('should apply provided button style', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = {
      label: 'Hello',
      uswdsStyle: UswdsButtonStyle.Cool,
    };
    const cancelButton = {
      label: 'World',
      uswdsStyle: UswdsButtonStyle.Cool,
    };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
          cancelButton={cancelButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('toggle-modal-button-submit');
    expect(submit.className).toContain(BUTTON_BASE_CLASS);
    expect(submit.className).toContain(UswdsButtonStyle.Cool);

    const cancel = screen.getByTestId('toggle-modal-button-cancel');
    expect(cancel.className).toContain(BUTTON_BASE_CLASS);
    expect(cancel.className).toContain(UswdsButtonStyle.Cool);
  });

  test('should apply default button style', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { label: 'Hello' };
    const cancelButton = { label: 'World' };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
          cancelButton={cancelButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('toggle-modal-button-submit');
    expect(submit.className).toContain(BUTTON_BASE_CLASS);

    const cancel = screen.getByTestId('toggle-modal-button-cancel');
    expect(cancel.className).toContain(BUTTON_BASE_CLASS);
    expect(cancel.className).toContain(UswdsButtonStyle.Unstyled);
  });

  test('should not have a cancel button', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { label: 'Hello' };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const cancel = screen.queryByTestId('toggle-modal-button-cancel');
    expect(cancel).not.toBeInTheDocument();
  });

  test('should apply provided classes instead of defaults', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { label: 'Hello', className: 'test-class-one' };
    const cancelButton = { label: 'World', className: 'test-class-two' };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
          cancelButton={cancelButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('toggle-modal-button-submit');
    expect(submit.className).toContain(BUTTON_BASE_CLASS);
    expect(submit.className).toContain('test-class-one');

    const cancel = screen.getByTestId('toggle-modal-button-cancel');
    expect(cancel.className).toContain(BUTTON_BASE_CLASS);
    expect(cancel.className).toContain(UswdsButtonStyle.Unstyled);
    expect(cancel.className).toContain('test-class-two');
    expect(cancel.className).not.toContain('padding-105');
    expect(cancel.className).not.toContain('text-center');
  });

  test('should disable submit button', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { label: 'Hello', disabled: true };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('toggle-modal-button-submit');
    expect(submit).toBeDisabled();
  });

  test('should not disable submit button with explicit false', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { label: 'Hello', disabled: false };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('toggle-modal-button-submit');
    expect(submit).not.toBeDisabled();
  });

  test('should not disable submit button by default', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { label: 'Hello' };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('toggle-modal-button-submit');
    expect(submit).not.toBeDisabled();
  });
});
