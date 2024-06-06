import { render, waitFor } from '@testing-library/react';
import { Validation, ValidationProps, ValidationStep } from './Validation';
import { createRef, forwardRef, useImperativeHandle, useState } from 'react';

interface TestFixtureRef {
  changeProps: (props: Partial<ValidationProps>) => void;
}

function _TestFixture(props: Partial<ValidationProps>, ref: React.Ref<TestFixtureRef>) {
  const defaultProps: ValidationProps = {
    id: 'validation-test',
    title: 'Validation Test',
    message: 'This is a test validation',
    steps: [],
    className: 'validation-test-class',
  };

  const [renderProps, setRenderProps] = useState<ValidationProps>({ ...defaultProps, ...props });

  function changeProps(props: Partial<ValidationProps>) {
    setRenderProps({ ...renderProps, ...props });
  }

  useImperativeHandle(
    ref,
    () => ({
      changeProps,
    }),
    [],
  );

  return <Validation {...renderProps} />;
}
const TestFixture = forwardRef(_TestFixture);

describe('Test simple validation component', () => {
  function renderWithProps(props: Partial<ValidationProps>) {
    const ref = createRef<TestFixtureRef>();
    render(<TestFixture {...props} ref={ref} />);
    return ref;
  }

  test('should place a check next to first item when first step valid is true', async () => {
    const steps: ValidationStep[] = [
      {
        label: 'Step 1',
        valid: false,
        className: 'step-1-test',
      },
      {
        label: 'Step 2',
        valid: false,
        className: 'step-2-test',
      },
      {
        label: 'Step 3',
        valid: false,
        className: 'step-3-test',
      },
    ];

    const ref = renderWithProps({ steps });

    const verificationSteps = document.querySelectorAll('.verification-step');

    expect(verificationSteps[0]).not.toHaveClass('valid');
    expect(verificationSteps[1]).not.toHaveClass('valid');
    expect(verificationSteps[2]).not.toHaveClass('valid');

    steps[0].valid = true;
    ref.current?.changeProps({ steps });

    await waitFor(() => {
      expect(verificationSteps[0]).toHaveClass('valid');
      expect(verificationSteps[1]).not.toHaveClass('valid');
      expect(verificationSteps[2]).not.toHaveClass('valid');
    });

    steps[1].valid = true;
    ref.current?.changeProps({ steps });

    await waitFor(() => {
      expect(verificationSteps[0]).toHaveClass('valid');
      expect(verificationSteps[1]).toHaveClass('valid');
      expect(verificationSteps[2]).not.toHaveClass('valid');
    });

    steps[2].valid = true;
    ref.current?.changeProps({ steps });

    await waitFor(() => {
      expect(verificationSteps[0]).toHaveClass('valid');
      expect(verificationSteps[1]).toHaveClass('valid');
      expect(verificationSteps[2]).toHaveClass('valid');
    });

    steps[1].valid = false;
    ref.current?.changeProps({ steps });

    await waitFor(() => {
      expect(verificationSteps[0]).toHaveClass('valid');
      expect(verificationSteps[1]).not.toHaveClass('valid');
      expect(verificationSteps[2]).toHaveClass('valid');
    });

    steps[2].valid = false;
    ref.current?.changeProps({ steps });

    await waitFor(() => {
      expect(verificationSteps[0]).toHaveClass('valid');
      expect(verificationSteps[1]).not.toHaveClass('valid');
      expect(verificationSteps[2]).not.toHaveClass('valid');
    });

    steps[0].valid = false;
    ref.current?.changeProps({ steps });

    await waitFor(() => {
      expect(verificationSteps[0]).not.toHaveClass('valid');
      expect(verificationSteps[1]).not.toHaveClass('valid');
      expect(verificationSteps[2]).not.toHaveClass('valid');
    });
  });
});
