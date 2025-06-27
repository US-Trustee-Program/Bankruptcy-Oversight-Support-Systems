import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RichTextButton } from './RichTextButton';

// Mock the Button component
vi.mock('../../uswds/Button', () => ({
  default: vi.fn((props) => {
    const { children, ...restProps } = props;
    return (
      <button {...restProps} data-testid="uswds-button">
        {children}
      </button>
    );
  }),
}));

// Mock the RichTextIcon component
vi.mock('./RichTextIcon', () => ({
  RichTextIcon: vi.fn(({ name }) => <span data-testid="rich-text-icon">{name}</span>),
}));

describe('RichTextButton', () => {
  const defaultProps = {
    title: 'Test Button',
    ariaLabel: 'Test button aria label',
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('renders button with icon when icon prop is provided', () => {
    render(<RichTextButton {...defaultProps} icon="bold" />);

    const button = screen.getByTestId('uswds-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-label', 'Test button aria label');
    expect(button).toHaveAttribute('title', 'Test Button');
    expect(button).toHaveClass('usa-button', 'rich-text-button');

    const icon = screen.getByTestId('rich-text-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('bold');
  });

  test('renders button with children when icon prop is not provided', () => {
    render(
      <RichTextButton {...defaultProps}>
        <span>Button Text</span>
      </RichTextButton>,
    );

    const button = screen.getByTestId('uswds-button');
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Button Text')).toBeInTheDocument();
    expect(screen.queryByTestId('rich-text-icon')).not.toBeInTheDocument();
  });

  test('calls onClick when button is clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<RichTextButton {...defaultProps} onClick={handleClick} icon="italic" />);

    const button = screen.getByTestId('uswds-button');
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('applies custom style when provided', () => {
    const customStyle = { backgroundColor: 'red', color: 'white' };

    render(<RichTextButton {...defaultProps} style={customStyle} icon="underline" />);

    const button = screen.getByTestId('uswds-button');
    expect(button).toHaveStyle('background-color: rgb(255, 0, 0)');
    expect(button).toHaveStyle('color: rgb(255, 255, 255)');
  });

  test('renders both icon and children when both are provided', () => {
    render(
      <RichTextButton {...defaultProps} icon="link">
        <span>Link Text</span>
      </RichTextButton>,
    );

    const icon = screen.getByTestId('rich-text-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('link');

    // Children should not be rendered when icon is present
    expect(screen.queryByText('Link Text')).not.toBeInTheDocument();
  });

  test('handles empty icon string', () => {
    render(
      <RichTextButton {...defaultProps} icon="">
        <span>Fallback Text</span>
      </RichTextButton>,
    );

    // Empty string is falsy, so children should be rendered
    expect(screen.getByText('Fallback Text')).toBeInTheDocument();
    expect(screen.queryByTestId('rich-text-icon')).not.toBeInTheDocument();
  });

  test('renders with correct button attributes', () => {
    render(<RichTextButton {...defaultProps} icon="bold" />);

    const button = screen.getByTestId('uswds-button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-label', 'Test button aria label');
    expect(button).toHaveAttribute('title', 'Test Button');
    expect(button).toHaveClass('usa-button', 'rich-text-button');
  });
});
