import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import CompletionStatusTag from './CompletionStatusTag';

describe('CompletionStatusTag', () => {
  test('renders a green "Complete for {year}" tag when status is Complete', () => {
    render(<CompletionStatusTag id="test-status" status="Complete" year={2026} />);

    const tag = screen.getByTestId('tag-test-status');
    expect(tag).toHaveTextContent('Complete for 2026');
    expect(tag.className).toContain('bg-success');
  });

  test('renders a themed "Incomplete for {year}" tag when status is Incomplete', () => {
    render(<CompletionStatusTag id="test-status" status="Incomplete" year={2026} />);

    const tag = screen.getByTestId('tag-test-status');
    expect(tag).toHaveTextContent('Incomplete for 2026');
    expect(tag.className).toContain('bg-secondary-dark');
  });
});
