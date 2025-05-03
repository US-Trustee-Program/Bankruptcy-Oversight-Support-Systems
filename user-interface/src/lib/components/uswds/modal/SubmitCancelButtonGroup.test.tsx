import { BUTTON_BASE_CLASS, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelButtonGroup } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

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
          cancelButton={cancelButton}
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('button-fake-modal-submit-button');
    expect(submit.className).toContain(BUTTON_BASE_CLASS);
    expect(submit.className).toContain(UswdsButtonStyle.Cool);

    const cancel = screen.getByTestId('button-fake-modal-cancel-button');
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
          cancelButton={cancelButton}
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('button-fake-modal-submit-button');
    expect(submit.className).toContain(BUTTON_BASE_CLASS);

    const cancel = screen.getByTestId('button-fake-modal-cancel-button');
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

    const cancel = screen.queryByTestId('button-fake-modal-cancel-button');
    expect(cancel).not.toBeInTheDocument();
  });

  test('should apply provided classes instead of defaults', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { className: 'test-class-one', label: 'Hello' };
    const cancelButton = { className: 'test-class-two', label: 'World' };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          cancelButton={cancelButton}
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('button-fake-modal-submit-button');
    expect(submit.className).toContain(BUTTON_BASE_CLASS);
    expect(submit.className).toContain('test-class-one');

    const cancel = screen.getByTestId('button-fake-modal-cancel-button');
    expect(cancel.className).toContain(BUTTON_BASE_CLASS);
    expect(cancel.className).toContain(UswdsButtonStyle.Unstyled);
    expect(cancel.className).toContain('test-class-two');
    expect(cancel.className).not.toContain('padding-105');
  });

  test('should disable submit button', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { disabled: true, label: 'Hello' };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('button-fake-modal-submit-button');
    expect(submit).toBeDisabled();
  });

  test('should not disable submit button with explicit false', () => {
    const modalRef = React.createRef<ModalRefType>();
    const submitButton = { disabled: false, label: 'Hello' };
    render(
      <BrowserRouter>
        <SubmitCancelButtonGroup
          modalId={'fake-modal'}
          modalRef={modalRef}
          submitButton={submitButton}
        ></SubmitCancelButtonGroup>
      </BrowserRouter>,
    );

    const submit = screen.getByTestId('button-fake-modal-submit-button');
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

    const submit = screen.getByTestId('button-fake-modal-submit-button');
    expect(submit).not.toBeDisabled();
  });
});
