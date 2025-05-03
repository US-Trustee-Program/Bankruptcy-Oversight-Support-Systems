import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ToggleButton from './ToggleButton';

describe('ToggleButton', () => {
  test('should render with inactive state', () => {
    render(
      <ToggleButton
        ariaLabel="Test Button"
        id="test-button"
        isActive={false}
        label="Test Button"
        onToggle={() => false}
        tooltipLabel="Test Button"
      />,
    );

    const button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');
    expect(button).toHaveAttribute('aria-checked', 'false');
    expect(button).toHaveTextContent('Test Button');
    expect(button).toHaveAttribute('title', 'Test Button');
  });

  test('should render with active state', () => {
    render(
      <ToggleButton
        ariaLabel="Test Button"
        id="test-button"
        isActive={true}
        label="Test Button"
        onToggle={() => true}
        tooltipLabel="Test Button"
      />,
    );

    const button = screen.getByRole('switch');
    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-checked', 'true');
    expect(button).toHaveTextContent('Test Button');
  });

  test('should toggle state on click', async () => {
    const onToggle = vi.fn();
    render(
      <ToggleButton
        ariaLabel="Test Button"
        id="test-button"
        isActive={false}
        label="Test Button"
        onToggle={onToggle}
        tooltipLabel="Test Button"
      />,
    );

    const button = screen.getByRole('switch');
    await userEvent.click(button);

    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-checked', 'true');
    expect(onToggle).toHaveBeenCalledWith(true);

    await userEvent.click(button);
    expect(button).toHaveClass('inactive');
    expect(button).toHaveAttribute('aria-checked', 'false');
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  test('should render with ModeLabel', async () => {
    render(
      <ToggleButton
        ariaLabel={{ active: 'Active Aria Label', inactive: 'Inactive Aria Label' }}
        id="test-button"
        isActive={false}
        label={{ active: 'Active Label', inactive: 'Inactive Label' }}
        onToggle={() => false}
        tooltipLabel={{ active: 'Active Tooltip', inactive: 'Inactive Tooltip' }}
      />,
    );

    const button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');
    expect(button).toHaveAttribute('aria-label', 'Inactive Aria Label');
    expect(button).toHaveAttribute('title', 'Inactive Tooltip');
    expect(button).toHaveTextContent('Inactive Label');

    await userEvent.click(button);
    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-label', 'Active Aria Label');
    expect(button).toHaveAttribute('title', 'Active Tooltip');
    expect(button).toHaveTextContent('Active Label');
  });

  test('should render with static string labels', async () => {
    const staticLabel = 'Foo Bar';
    render(
      <ToggleButton
        ariaLabel={staticLabel}
        id="test-button"
        isActive={false}
        label={staticLabel}
        onToggle={() => false}
        tooltipLabel={staticLabel}
      />,
    );

    const button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');
    expect(button).toHaveAttribute('aria-label', staticLabel);
    expect(button).toHaveAttribute('title', staticLabel);
    expect(button).toHaveTextContent(staticLabel);

    await userEvent.click(button);
    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-label', staticLabel);
    expect(button).toHaveAttribute('title', staticLabel);
    expect(button).toHaveTextContent(staticLabel);
  });

  test('should update state from props', () => {
    const { rerender } = render(
      <ToggleButton
        ariaLabel="Test Button"
        id="test-button"
        isActive={false}
        label="Test Button"
        onToggle={() => false}
        tooltipLabel="Test Button"
      />,
    );

    let button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');

    rerender(
      <ToggleButton
        ariaLabel="Test Button"
        id="test-button"
        isActive={true}
        label="Test Button"
        onToggle={() => true}
        tooltipLabel="Test Button"
      />,
    );

    button = screen.getByRole('switch');
    expect(button).toHaveClass('active');
  });
});
