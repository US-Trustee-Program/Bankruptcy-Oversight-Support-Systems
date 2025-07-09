import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RichTextButton } from './RichTextButton';

describe('RichTextButton', () => {
  it('renders with text content', () => {
    const onClickMock = vi.fn();
    render(
      <RichTextButton title="Bold" ariaLabel="Bold formatting" onClick={onClickMock}>
        B
      </RichTextButton>,
    );

    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Bold');
  });

  it('renders with icon', () => {
    const onClickMock = vi.fn();
    render(
      <RichTextButton
        icon="bulleted-list"
        title="Bulleted List"
        ariaLabel="Insert bulleted list"
        onClick={onClickMock}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Bulleted List');
    // The bulleted-list icon uses an img tag, not a .usa-icon class
    expect(button.querySelector('img')).toBeInTheDocument();
  });

  it('reflects active state when provided', () => {
    const onClickMock = vi.fn();
    render(
      <RichTextButton title="Bold" ariaLabel="Bold formatting" onClick={onClickMock} active={true}>
        B
      </RichTextButton>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not have active state when active prop is false', () => {
    const onClickMock = vi.fn();
    render(
      <RichTextButton title="Bold" ariaLabel="Bold formatting" onClick={onClickMock} active={false}>
        B
      </RichTextButton>,
    );

    const button = screen.getByRole('button');
    expect(button).not.toHaveClass('active');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
