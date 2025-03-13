import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToggleButton from './ToggleButton';

describe('ToggleButton', () => {
  test('should render with inactive state', () => {
    render(
      <ToggleButton
        id="test-button"
        label="Test Button"
        ariaLabel="Test Button"
        isActive={false}
        onToggle={() => false}
      />,
    );

    const button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');
    expect(button).toHaveAttribute('aria-checked', 'false');
    expect(button).toHaveTextContent('Test Button');
  });

  test('should render with active state', () => {
    render(
      <ToggleButton
        id="test-button"
        label="Test Button"
        ariaLabel="Test Button"
        isActive={true}
        onToggle={() => true}
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
        id="test-button"
        label="Test Button"
        ariaLabel="Test Button"
        isActive={false}
        onToggle={onToggle}
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
        id="test-button"
        label={{ active: 'Active Label', inactive: 'Inactive Label' }}
        ariaLabel={{ active: 'Active Aria Label', inactive: 'Inactive Aria Label' }}
        isActive={false}
        onToggle={() => false}
      />,
    );

    const button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');
    expect(button).toHaveAttribute('aria-label', 'Inactive Aria Label');
    expect(button).toHaveTextContent('Inactive Label');

    await userEvent.click(button);
    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-label', 'Active Aria Label');
    expect(button).toHaveTextContent('Active Label');
  });

  test('should render with static string labels', async () => {
    const staticLabel = 'Foo Bar';
    render(
      <ToggleButton
        id="test-button"
        label={staticLabel}
        ariaLabel={staticLabel}
        isActive={false}
        onToggle={() => false}
      />,
    );

    const button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');
    expect(button).toHaveAttribute('aria-label', staticLabel);
    expect(button).toHaveTextContent(staticLabel);

    await userEvent.click(button);
    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-label', staticLabel);
    expect(button).toHaveTextContent(staticLabel);
  });

  test('should update state from props', () => {
    const { rerender } = render(
      <ToggleButton
        id="test-button"
        label="Test Button"
        ariaLabel="Test Button"
        isActive={false}
        onToggle={() => false}
      />,
    );

    let button = screen.getByRole('switch');
    expect(button).toHaveClass('inactive');

    rerender(
      <ToggleButton
        id="test-button"
        label="Test Button"
        ariaLabel="Test Button"
        isActive={true}
        onToggle={() => true}
      />,
    );

    button = screen.getByRole('switch');
    expect(button).toHaveClass('active');
  });
});
