import React from 'react';
import CamsSelect from './CamsSelect';
import { InputRef } from '../type-declarations/input-fields';
import { render, screen, waitFor } from '@testing-library/react';

describe('Tests for humble CamsSelect component', () => {
  const ref = React.createRef<InputRef>();
  const youChangedMe = vi.fn();

  beforeEach(() => {
    render(
      <div>
        <CamsSelect
          ref={ref}
          id="select-1"
          label="Searchable Select"
          onChange={youChangedMe}
          value="2"
          options={[
            {
              value: '0',
              label: 'Option 0',
            },
            {
              value: '1',
              label: 'Option 1',
            },
            {
              value: '2',
              label: 'Option 2',
            },
          ]}
        ></CamsSelect>
      </div>,
    );
  });

  test('Should set value when ref.setValue() is called and reset to original value when ref.resetValue() is called.', async () => {
    const initialValue = screen.getByText('Option 2');
    expect(initialValue).toBeInTheDocument();

    ref.current?.setValue('1');
    await waitFor(() => {
      const value1 = screen.getByText('Option 1');
      expect(value1).toBeInTheDocument();
    });

    ref.current?.resetValue();
    await waitFor(() => {
      const value1 = screen.getByText('Option 2');
      expect(value1).toBeInTheDocument();
    });
  });

  test('Should set value when ref.clearValue() is called.', async () => {
    const initialValue = screen.getByText('Option 2');
    expect(initialValue).toBeInTheDocument();

    ref.current?.setValue('1');
    await waitFor(() => {
      const value1 = screen.getByText('Option 1');
      expect(value1).toBeInTheDocument();
    });

    ref.current?.clearValue();
    await waitFor(() => {
      const value1 = screen.getByText('Select...');
      expect(value1).toBeInTheDocument();
    });
  });
});
