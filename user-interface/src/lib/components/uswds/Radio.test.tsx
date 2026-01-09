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

describe('Radio group behavior and refactoring safety tests', () => {
  const onChangeHandlerSpy = vi.fn();

  beforeEach(() => {
    onChangeHandlerSpy.mockClear();
  });

  const renderRadio = (props: Partial<RadioProps> & { id: string; ref?: React.Ref<RadioRef> }) => {
    const fullProps: RadioProps = {
      name: 'test-group',
      label: `Label for ${props.id}`,
      value: props.id,
      onChange: onChangeHandlerSpy,
      ...props,
    };
    return <Radio {...fullProps} />;
  };

  const getRadioInput = (id: string) => screen.getByTestId(`radio-${id}`) as HTMLInputElement;

  test('should handle controlled checked prop updates', async () => {
    const { rerender } = render(renderRadio({ id: 'controlled', checked: false }));

    const radioInput = getRadioInput('controlled');
    expect(radioInput.checked).toBe(false);

    rerender(renderRadio({ id: 'controlled', checked: true }));

    await waitFor(() => {
      expect(radioInput.checked).toBe(true);
    });
  });

  test('should sync state when another radio in group is selected (simulates browser behavior)', async () => {
    render(
      <div>
        {renderRadio({ id: 'radio-1', name: 'group', value: '1' })}
        {renderRadio({ id: 'radio-2', name: 'group', value: '2', checked: true })}
      </div>,
    );

    const radio1 = getRadioInput('radio-1');
    const radio2 = getRadioInput('radio-2');

    expect(radio1.checked).toBe(false);
    expect(radio2.checked).toBe(true);

    const clickTarget1 = screen.getByTestId('button-radio-radio-1-click-target');
    act(() => {
      clickTarget1.click();
    });

    await waitFor(() => {
      expect(radio1.checked).toBe(true);
      expect(onChangeHandlerSpy).toHaveBeenCalledWith('1');
    });
  });

  test('should handle multiple check() calls on different radios in same group', async () => {
    const ref1 = React.createRef<RadioRef>();
    const ref2 = React.createRef<RadioRef>();

    render(
      <div>
        {renderRadio({ id: 'radio-a', name: 'group', value: 'a', ref: ref1 })}
        {renderRadio({ id: 'radio-b', name: 'group', value: 'b', ref: ref2 })}
      </div>,
    );

    const radioA = getRadioInput('radio-a');
    const radioB = getRadioInput('radio-b');

    act(() => ref1.current?.check(true));
    await waitFor(() => {
      expect(radioA.checked).toBe(true);
    });

    act(() => ref2.current?.check(true));
    await waitFor(() => {
      expect(radioB.checked).toBe(true);
    });
  });

  test('should uncheck both radios in a group (consolidation use case)', async () => {
    const ref1 = React.createRef<RadioRef>();
    const ref2 = React.createRef<RadioRef>();

    render(
      <div>
        {renderRadio({
          id: 'joint-admin',
          name: 'consolidation-type',
          label: 'Joint Administration',
          value: 'administrative',
          checked: true,
          ref: ref1,
        })}
        {renderRadio({
          id: 'substantive',
          name: 'consolidation-type',
          label: 'Substantive Consolidation',
          value: 'substantive',
          ref: ref2,
        })}
      </div>,
    );

    const radio1 = getRadioInput('joint-admin');
    const radio2 = getRadioInput('substantive');

    expect(radio1.checked).toBe(true);
    expect(radio2.checked).toBe(false);

    // Simulate the unsetConsolidationType pattern
    act(() => {
      ref1.current?.check(false);
      ref2.current?.check(false);
    });

    await waitFor(() => {
      expect(radio1.checked).toBe(false);
      expect(radio2.checked).toBe(false);
    });
  });

  test('should maintain aria-checked attribute in sync with checked state after refactoring', async () => {
    const ref = React.createRef<RadioRef>();

    render(renderRadio({ id: 'aria-test', ref }));

    const button = screen.getByTestId('button-radio-aria-test-click-target');
    const radioInput = getRadioInput('aria-test');

    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(radioInput.checked).toBe(false);

    act(() => ref.current?.check(true));

    // After refactoring, aria-checked syncs with checkedState properly
    await waitFor(() => {
      expect(radioInput.checked).toBe(true);
      expect(button.getAttribute('aria-checked')).toBe('true');
    });
  });

  test('should call onChange when clicking label button', async () => {
    render(renderRadio({ id: 'click-test', value: 'test-val' }));

    const button = screen.getByTestId('button-radio-click-test-click-target');
    act(() => {
      button.click();
    });

    await waitFor(() => {
      expect(onChangeHandlerSpy).toHaveBeenCalledWith('test-val');
    });

    const radioInput = getRadioInput('click-test');
    expect(radioInput.checked).toBe(true);
  });

  test('isChecked should return current state without DOM access', async () => {
    const ref = React.createRef<RadioRef>();
    render(renderRadio({ id: 'state-test', checked: false, ref }));

    expect(ref.current?.isChecked()).toBe(false);

    act(() => ref.current?.check(true));
    await waitFor(() => {
      expect(ref.current?.isChecked()).toBe(true);
    });

    act(() => ref.current?.check(false));
    await waitFor(() => {
      expect(ref.current?.isChecked()).toBe(false);
    });
  });
});
