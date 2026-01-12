import { fireEvent, render, screen } from '@testing-library/react';
import { RadioGroup, RadioGroupProps } from './RadioGroup';
import Radio from './Radio';

describe('Test RadioGroup', () => {
  const defaultProps: RadioGroupProps = {
    label: 'Radio Group Label',
  };

  function renderWithProps(props?: object) {
    const radioProps = { ...defaultProps, ...props };

    render(
      <RadioGroup {...radioProps}>
        <div />
      </RadioGroup>,
    );
  }

  function renderRadioGroup(
    count: number,
    options?: {
      groupProps?: Partial<RadioGroupProps>;
      disabledIndices?: number[];
    },
  ) {
    const onChangeFunctions = Array.from({ length: count }, () => vi.fn());
    const groupPropsWithDefaults = { label: 'Test Group', ...options?.groupProps };

    render(
      <RadioGroup {...groupPropsWithDefaults}>
        {onChangeFunctions.map((onChange, index) => (
          <Radio
            key={`radio${index + 1}`}
            id={`radio${index + 1}`}
            name="test"
            label={`Radio ${index + 1}`}
            value={`${index + 1}`}
            onChange={onChange}
            disabled={options?.disabledIndices?.includes(index)}
          />
        ))}
      </RadioGroup>,
    );

    const buttons = onChangeFunctions.map((_, index) =>
      screen.getByTestId(`button-radio-radio${index + 1}-click-target`),
    );

    return { buttons, onChangeFunctions };
  }

  test('Should set className when provided', () => {
    const expectedClassName = 'expected-class-name';
    renderWithProps({ className: expectedClassName });

    const fieldSet = document.querySelector('fieldset');
    expect(fieldSet).toHaveClass(expectedClassName);
  });

  test('Should only include "usa-fieldset" className when no className provided', () => {
    renderWithProps();

    const fieldSet = document.querySelector('fieldset');
    expect(fieldSet).toHaveAttribute('class', 'usa-fieldset radio-group ');
  });

  test('Should have data-required attribute when required is true', () => {
    renderWithProps({ required: true });

    const legend = document.querySelector('legend');
    expect(legend).toHaveAttribute('data-required', 'true');
  });

  test('Should NOT have data-required attribute when required is not supplied', () => {
    renderWithProps();

    const legend = document.querySelector('legend');
    expect(legend).not.toHaveAttribute('data-required');
  });

  test('Should navigate to next radio with ArrowDown key', () => {
    const { buttons, onChangeFunctions } = renderRadioGroup(3);

    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' });

    expect(onChangeFunctions[1]).toHaveBeenCalledWith('2');
  });

  test('Should navigate to previous radio with ArrowUp key', () => {
    const { buttons, onChangeFunctions } = renderRadioGroup(3);

    buttons[1].focus();
    fireEvent.keyDown(buttons[1], { key: 'ArrowUp' });

    expect(onChangeFunctions[0]).toHaveBeenCalledWith('1');
  });

  test('Should navigate to next radio with ArrowRight key', () => {
    const { buttons, onChangeFunctions } = renderRadioGroup(2);

    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });

    expect(onChangeFunctions[1]).toHaveBeenCalledWith('2');
  });

  test('Should navigate to previous radio with ArrowLeft key', () => {
    const { buttons, onChangeFunctions } = renderRadioGroup(2);

    buttons[1].focus();
    fireEvent.keyDown(buttons[1], { key: 'ArrowLeft' });

    expect(onChangeFunctions[0]).toHaveBeenCalledWith('1');
  });

  test('Should wrap around to first radio when navigating forward from last radio', () => {
    const { buttons, onChangeFunctions } = renderRadioGroup(3);

    buttons[2].focus();
    fireEvent.keyDown(buttons[2], { key: 'ArrowDown' });

    expect(onChangeFunctions[0]).toHaveBeenCalledWith('1');
  });

  test('Should wrap around to last radio when navigating backward from first radio', () => {
    const { buttons, onChangeFunctions } = renderRadioGroup(3);

    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: 'ArrowUp' });

    expect(onChangeFunctions[2]).toHaveBeenCalledWith('3');
  });

  test('Should handle empty radio group', () => {
    render(<RadioGroup label="Empty Group"></RadioGroup>);

    const fieldset = document.querySelector('fieldset');
    expect(fieldset).toBeInTheDocument();

    // Should not error when navigating in empty group
    fireEvent.keyDown(fieldset!, { key: 'ArrowDown' });
  });

  test('Should start at first radio when arrow key pressed from outside radio buttons', () => {
    const { onChangeFunctions } = renderRadioGroup(2);

    const fieldset = document.querySelector('fieldset')!;

    // Trigger keydown on the fieldset itself (not on any radio button)
    // This simulates when the currentIndex is -1 (target not found in radio list)
    fireEvent.keyDown(fieldset, { key: 'ArrowDown', target: fieldset });

    // Should select the first radio
    expect(onChangeFunctions[0]).toHaveBeenCalledWith('1');
  });

  test('Should not handle non-arrow keys', () => {
    const { buttons, onChangeFunctions } = renderRadioGroup(2);

    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: 'Tab' });

    // Should not navigate when pressing non-arrow keys
    expect(onChangeFunctions[1]).not.toHaveBeenCalled();
  });
});
