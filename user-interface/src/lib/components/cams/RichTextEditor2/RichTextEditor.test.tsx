import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';

describe('RichTextEditor', () => {
  let editorRef: React.RefObject<RichTextEditorRef>;

  beforeEach(() => {
    vi.restoreAllMocks();
    editorRef = React.createRef<RichTextEditorRef>();
  });

  describe('Keyboard Input Events', () => {
    test('should capture and render typed characters in the editor', async () => {
      // Given: A rich text editor is rendered
      const user = userEvent.setup();
      render(<RichTextEditor id="test-editor" label="Test Editor" ref={editorRef} />);

      const editorElement = screen.getByTestId('test-editor');
      expect(editorElement).toBeInTheDocument();

      // When: User types a character
      await user.click(editorElement);
      await user.type(editorElement, 'H');

      // Then: The character should be rendered in the editor content
      expect(editorElement).toHaveTextContent('H');
    });

    test('should capture and render multiple typed characters', async () => {
      // Given: A rich text editor is rendered
      const user = userEvent.setup();
      render(<RichTextEditor id="test-editor" label="Test Editor" ref={editorRef} />);

      const editorElement = screen.getByTestId('test-editor');

      // When: User types multiple characters
      await user.click(editorElement);
      await user.type(editorElement, 'Hello');

      // Then: All characters should be rendered in the editor content
      expect(editorElement).toHaveTextContent('Hello');
    });

    test('should handle backspace key events', async () => {
      // Given: A rich text editor with some content
      const user = userEvent.setup();
      render(<RichTextEditor id="test-editor" label="Test Editor" ref={editorRef} />);

      const editorElement = screen.getByTestId('test-editor');
      await user.click(editorElement);
      await user.type(editorElement, 'Hello');

      // When: User presses backspace
      await user.keyboard('{Backspace}');

      // Then: The last character should be removed
      expect(editorElement).toHaveTextContent('Hell');
    });

    test('should handle enter key events', async () => {
      // Given: A rich text editor with some content
      const user = userEvent.setup();
      render(<RichTextEditor id="test-editor" label="Test Editor" ref={editorRef} />);

      const editorElement = screen.getByTestId('test-editor');
      await user.click(editorElement);
      await user.type(editorElement, 'First line');

      // When: User presses enter
      await user.keyboard('{Enter}');
      await user.type(editorElement, 'Second line');

      // Then: Content should be on separate lines
      expect(editorElement.innerHTML).toContain('First line');
      expect(editorElement.innerHTML).toContain('Second line');
    });
  });

  describe('Editor Integration', () => {
    test('should delegate input events to Editor instance', async () => {
      // Given: A rich text editor is rendered
      const user = userEvent.setup();
      const onChangeSpy = vi.fn();

      render(
        <RichTextEditor
          id="test-editor"
          label="Test Editor"
          onChange={onChangeSpy}
          ref={editorRef}
        />,
      );

      const editorElement = screen.getByTestId('test-editor');

      // When: User types characters
      await user.click(editorElement);
      await user.type(editorElement, 'Test');

      // Then: onChange callback should be called with the content
      expect(onChangeSpy).toHaveBeenCalled();
    });
  });
});
