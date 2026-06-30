import { render } from '@testing-library/react';
import { describe } from 'vitest';
import DocumentTitle from './DocumentTitle';

describe('DocumentTitle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('sets document.title on mount', () => {
    render(<DocumentTitle name="Test Page" />);
    expect(document.title).toBe('Test Page | U.S. Trustee Program - Case Management System (CAMS)');
  });

  test('updates document.title when name prop changes', () => {
    const { rerender } = render(<DocumentTitle name="First" />);
    expect(document.title).toBe('First | U.S. Trustee Program - Case Management System (CAMS)');

    rerender(<DocumentTitle name="Second" />);
    expect(document.title).toBe('Second | U.S. Trustee Program - Case Management System (CAMS)');
  });
});
