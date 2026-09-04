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

  test('should not surface tooltip as aria-label when still decorative', () => {
    renderWithProps({ name: 'info', tooltip: 'Should be ignored' });
    const icon = screen.getByTestId('icon');
    expect(icon).not.toHaveAttribute('aria-label');
  });

  test('should not be decorative when decorative is false', () => {
    renderWithProps({ name: 'warning', decorative: false });
    const icon = screen.getByTestId('icon');
    expect(icon).not.toHaveAttribute('aria-hidden');
    expect(icon).toHaveAttribute('role', 'img');
    expect(icon).toHaveAttribute('aria-label', 'warning icon');
  });

  test('should use the tooltip text as the aria-label when both are provided', () => {
    renderWithProps({ name: 'cancel', decorative: false, tooltip: 'Name does not match' });
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveAttribute('aria-label', 'Name does not match');
  });

  test('should fall back to the generic aria-label when tooltip is an empty string', () => {
    renderWithProps({ name: 'warning', decorative: false, tooltip: '' });
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveAttribute('aria-label', 'warning icon');
  });

  test('should not be focusable', () => {
    renderWithProps({ name: 'check' });
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveAttribute('focusable', 'false');
  });

  test('should not render a title element even when tooltip is provided', () => {
    // A <title> alongside aria-label duplicates the accessible name and causes some screen
    // readers (e.g. NVDA on hover) to announce it twice - aria-label alone is sufficient.
    renderWithProps({ name: 'info', decorative: false, tooltip: 'Information icon' });
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
