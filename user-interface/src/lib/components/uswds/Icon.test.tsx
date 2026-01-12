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

  test('should be decorative by default with aria-hidden and no role', () => {
    renderWithProps({ name: 'info' });
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).not.toHaveAttribute('role');
    expect(icon).not.toHaveAttribute('aria-label');
  });

  test('should not be decorative when decorative is false', () => {
    renderWithProps({ name: 'warning', decorative: false });
    const icon = screen.getByTestId('icon');
    expect(icon).not.toHaveAttribute('aria-hidden');
    expect(icon).toHaveAttribute('role', 'img');
    expect(icon).toHaveAttribute('aria-label', 'warning icon');
  });

  test('should be focusable when focusable prop is true', () => {
    renderWithProps({ name: 'check', focusable: true });
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveAttribute('focusable', 'true');
  });

  test('should not be focusable by default', () => {
    renderWithProps({ name: 'check' });
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveAttribute('focusable', 'false');
  });

  test('should render tooltip when provided', () => {
    renderWithProps({ name: 'info', tooltip: 'Information icon' });
    const icon = screen.getByTestId('icon');
    const title = icon.querySelector('title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('Information icon');
  });

  test('should not render tooltip when not provided', () => {
    renderWithProps({ name: 'info' });
    const icon = screen.getByTestId('icon');
    const title = icon.querySelector('title');
    expect(title).not.toBeInTheDocument();
  });

  test('should render correct sprite link', () => {
    renderWithProps({ name: 'close' });
    const icon = screen.getByTestId('icon');
    const use = icon.querySelector('use');
    expect(use).toHaveAttribute('xlink:href', '/assets/styles/img/sprite.svg#close');
  });
});
