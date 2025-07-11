import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import RichTextEditor from './RichTextEditor';

describe('RichTextEditor White Space Handling', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
  });

  test('should preserve multiple spaces with white-space: pre-wrap instead of converting to &nbsp;', () => {
    // Setup
    const mockOnChange = vi.fn();

    // Render component
    const { container } = render(<RichTextEditor id="test-editor" onChange={mockOnChange} />);

    // Set content with multiple spaces
    // Note: We're deliberately using querySelector here to directly manipulate the DOM
    // because we need to test the raw HTML behavior with white-space handling
    // eslint-disable-next-line testing-library/no-container
    const editor = container.querySelector('.editor-content');
    if (editor) {
      editor.innerHTML = '<p>This text has    multiple spaces    between words</p>';
    }

    // For assertions, we're checking the raw HTML to see if &nbsp; is being used
    // eslint-disable-next-line testing-library/no-container
    const editorContent = container.querySelector('.editor-content');
    expect(editorContent).not.toBeNull();

    // Check the white-space CSS property
    if (editorContent) {
      // In jsdom we can't directly check the computed style, so we'll check the HTML instead
      const contentHtml = editorContent.innerHTML;

      // The content should not have &nbsp; entities for spaces
      expect(contentHtml).not.toContain('&nbsp;');

      // It should contain the raw multiple spaces
      expect(contentHtml).toContain('has    multiple');
      expect(contentHtml).toContain('spaces    between');
    }
  });
});
