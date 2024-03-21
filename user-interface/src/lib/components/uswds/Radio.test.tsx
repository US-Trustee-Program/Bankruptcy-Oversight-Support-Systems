import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RadioRef } from '@/lib/type-declarations/input-fields';
import Radio, { RadioProps } from './Radio';

describe('Tests for USWDS Input component.', () => {
  const ref = React.createRef<RadioRef>();
  const onChangeHandlerSpy = vi.fn();

  const defaultProps: RadioProps = {
    id: 'radio-1',
    label: 'RadioLabelText',
    name: 'KeyName',
    value: '1',
    onChange: onChangeHandlerSpy,
  };

  beforeEach(() => {
    render(<Radio {...defaultProps} ref={ref}></Radio>);
  });

  test('should call onChange callback when checked or unchecked', async () => {
    const radioButton = screen.getByTestId(defaultProps.id);
    fireEvent.click(radioButton);
    await waitFor(() => {
      expect(radioButton).toBeChecked();
    });
    expect(onChangeHandlerSpy).toHaveBeenCalled();
    expect(onChangeHandlerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        target: radioButton,
      }),
    );
  });

  test('should render the radio button label', () => {
    const radioButtonLabel = document.querySelector('.usa-radio__label');
    expect(radioButtonLabel).toHaveTextContent(defaultProps.label);
  });

  test('should be able to check/uncheck programmatically', async () => {
    const radioButton = screen.getByTestId(defaultProps.id);
    expect(radioButton).not.toBeChecked();

    ref.current?.checked(true);
    await waitFor(() => {
      expect(radioButton).toBeChecked();
    });

    ref.current?.checked(false);
    await waitFor(() => {
      expect(radioButton).not.toBeChecked();
    });
  });

  test('should be able to disable/enable programmatically', async () => {
    const radioButton = screen.getByTestId(defaultProps.id);
    expect(radioButton).not.toBeDisabled();

    ref.current?.disable(true);
    await waitFor(() => {
      expect(radioButton).toBeDisabled();
    });

    ref.current?.disable(false);
    await waitFor(() => {
      expect(radioButton).not.toBeDisabled();
    });
  });
});
