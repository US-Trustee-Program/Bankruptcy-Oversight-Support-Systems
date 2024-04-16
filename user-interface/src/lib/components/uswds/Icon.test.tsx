import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Icon, { IconProps } from './Icon';

describe('Test Icon component', async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProps(props?: Partial<IconProps>) {
    const defaultProps: IconProps = {
      name: 'check',
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Icon {...renderProps} />
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  test('should add a class if className is provided', () => {
    const addedClassName = 'test-class';
    renderWithProps({ className: addedClassName });
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveClass(addedClassName);
  });

  test('should have the default class', () => {
    const defaultClassName = 'usa-icon';
    renderWithProps();
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveClass(defaultClassName);
  });
});
