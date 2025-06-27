import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { RichTextIcon } from './RichTextIcon';

// Mock the Icon component
vi.mock('@/lib/components/uswds/Icon', () => ({
  default: vi.fn(({ name }) => <span data-testid="uswds-icon">{name}</span>),
}));

describe('RichTextIcon', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('renders numbered-list icon', () => {
    render(<RichTextIcon name="numbered-list" />);

    const icon = screen.getByRole('img');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('src', '/numbered-list.svg');
    expect(icon).toHaveAttribute('alt', 'numbered list icon');
  });

  test('renders bulleted-list icon', () => {
    render(<RichTextIcon name="bulleted-list" />);

    const icon = screen.getByRole('img');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('src', '/bullet-list.svg');
    expect(icon).toHaveAttribute('alt', 'bulleted list icon');
  });

  test('renders link icon using USWDS Icon component', () => {
    render(<RichTextIcon name="link" />);

    const icon = screen.getByTestId('uswds-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('link');
  });

  test('returns empty string for unknown icon name', () => {
    const { container } = render(<RichTextIcon name="unknown-icon" />);

    expect(container.firstChild).toBeNull();
  });

  test('handles empty string icon name', () => {
    const { container } = render(<RichTextIcon name="" />);

    expect(container.firstChild).toBeNull();
  });
});
