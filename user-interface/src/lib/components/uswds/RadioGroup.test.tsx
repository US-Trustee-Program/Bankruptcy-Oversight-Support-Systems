import { render } from '@testing-library/react';
import { RadioGroup, RadioGroupProps } from './RadioGroup';

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

  test('Should set className when provided', () => {
    const expectedClassName = 'expected-class-name';
    renderWithProps({ className: expectedClassName });

    const fieldSet = document.querySelector('fieldset');
    expect(fieldSet).toHaveClass(expectedClassName);
  });

  test('Should only include "usa-fieldset" className when no className provided', () => {
    renderWithProps();

    const fieldSet = document.querySelector('fieldset');
    expect(fieldSet).toHaveAttribute('class', 'usa-fieldset ');
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
});
