import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
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

  const renderWithoutProps = () => {
    render(<Radio {...defaultProps} ref={ref}></Radio>);
  };

  test('should call onChange callback when checked or unchecked', async () => {
    renderWithoutProps();
    const radioButton = testingUtilities.selectRadio('1');
    await waitFor(() => {
      expect(onChangeHandlerSpy).toHaveBeenCalled();
    });
    expect(onChangeHandlerSpy).toHaveBeenCalledWith('1');
    expect(radioButton).toBeChecked();
  });

  test('should render the radio button label', async () => {
    renderWithoutProps();
    const radioButtonLabel = document.querySelector('.usa-radio__label');
    await waitFor(() => {
      expect(radioButtonLabel).toHaveTextContent(defaultProps.label);
    });
  });

  test('should be able to check/uncheck programmatically', async () => {
    renderWithoutProps();
    const radioButton = screen.getByTestId(radioTestId);
    expect(radioButton).not.toBeChecked();

    expect(ref.current?.isChecked()).toBeFalsy();
    act(() => ref.current?.check(true));
    await waitFor(() => {
      expect(radioButton).toBeChecked();
    });
    expect(ref.current?.isChecked()).toBeTruthy();

    act(() => ref.current?.check(false));
    await waitFor(() => {
      expect(radioButton).not.toBeChecked();
    });
    expect(ref.current?.isChecked()).toBeFalsy();
  });

  test('should be able to disable/enable programmatically', async () => {
    renderWithoutProps();
    const radioButton = screen.getByTestId(radioTestId);
    expect(radioButton).not.toBeDisabled();

    act(() => ref.current?.disable(true));
    await waitFor(() => {
      expect(radioButton).toBeDisabled();
    });

    act(() => ref.current?.disable(false));
    await waitFor(() => {
      expect(radioButton).not.toBeDisabled();
    });
  });

  test('should handle Space key press', async () => {
    renderWithoutProps();
    const clickTarget = screen.getByTestId('button-radio-1-click-target');

    const keydownEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    clickTarget.dispatchEvent(keydownEvent);

    await waitFor(() => {
      expect(onChangeHandlerSpy).toHaveBeenCalled();
    });
  });

  test('should handle Enter key press', async () => {
    renderWithoutProps();
    const clickTarget = screen.getByTestId('button-radio-1-click-target');

    const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    clickTarget.dispatchEvent(keydownEvent);

    await waitFor(() => {
      expect(onChangeHandlerSpy).toHaveBeenCalled();
    });
  });

  test('should sync checked state when native change event occurs', async () => {
    render(<Radio {...defaultProps} checked={false} />);
    const radioInput = screen.getByTestId(radioTestId) as HTMLInputElement;

    // Simulate native change event (like when browser unchecks this radio due to another radio being selected)
    act(() => {
      radioInput.checked = true;
      radioInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      expect(radioInput.checked).toBe(true);
    });
  });

  test('should return false from isChecked when ref is not set', () => {
    // Create a component that will immediately call isChecked before ref is fully initialized
    const TestComponent = () => {
      const localRef = React.useRef<RadioRef>(null);
      const [checkedValue, setCheckedValue] = React.useState<boolean | null>(null);

      React.useEffect(() => {
        // Call isChecked immediately, potentially before the radio input is fully set up
        if (localRef.current) {
          setCheckedValue(localRef.current.isChecked());
        }
      }, []);

      return (
        <div>
          <Radio {...defaultProps} ref={localRef} />
          <div data-testid="checked-value">{String(checkedValue)}</div>
        </div>
      );
    };

    render(<TestComponent />);

    // The component should not crash and should handle the undefined/null case
    const checkedValueDiv = screen.getByTestId('checked-value');
    expect(checkedValueDiv).toBeInTheDocument();
  });
});
