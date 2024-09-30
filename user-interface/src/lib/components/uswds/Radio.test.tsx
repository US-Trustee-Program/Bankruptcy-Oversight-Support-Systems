import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { RadioRef } from '@/lib/type-declarations/input-fields';
import Radio, { RadioProps } from './Radio';
import testingUtilities from '@/lib/testing/testing-utilities';

describe('Tests for USWDS Input component.', () => {
  const ref = React.createRef<RadioRef>();
  const onChangeHandlerSpy = vi.fn();

  const defaultProps: RadioProps = {
    id: '1',
    label: 'RadioLabelText',
    name: 'KeyName',
    value: '1',
    onChange: onChangeHandlerSpy,
  };

  const radioTestId = `radio-${defaultProps.id}`;

  beforeEach(() => {
    render(<Radio {...defaultProps} ref={ref}></Radio>);
  });

  test('should call onChange callback when checked or unchecked', async () => {
    const radioButton = testingUtilities.selectRadio('1');
    await waitFor(() => {
      expect(onChangeHandlerSpy).toHaveBeenCalled();
    });
    expect(onChangeHandlerSpy).toHaveBeenCalledWith('1');
    expect(radioButton).toBeChecked();
  });

  test('should render the radio button label', () => {
    const radioButtonLabel = document.querySelector('.usa-radio__label');
    expect(radioButtonLabel).toHaveTextContent(defaultProps.label);
  });

  test('should be able to check/uncheck programmatically', async () => {
    const radioButton = screen.getByTestId(radioTestId);
    expect(radioButton).not.toBeChecked();

    expect(ref.current?.isChecked()).toBeFalsy();
    ref.current?.check(true);
    await waitFor(() => {
      expect(radioButton).toBeChecked();
    });
    expect(ref.current?.isChecked()).toBeTruthy();

    ref.current?.check(false);
    await waitFor(() => {
      expect(radioButton).not.toBeChecked();
    });
    expect(ref.current?.isChecked()).toBeFalsy();
  });

  test('should be able to disable/enable programmatically', async () => {
    const radioButton = screen.getByTestId(radioTestId);
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
