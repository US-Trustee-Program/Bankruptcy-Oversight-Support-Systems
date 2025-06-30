import * as React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Editor } from './Editor';
import { MockSelectionService } from '../SelectionService.humble';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor/Editor.constants';

describe('Editor', () => {
  let mockElement: HTMLElement;
  let mockSelectionService: MockSelectionService;
  let editor: Editor;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Create a mock HTML element
    mockElement = document.createElement('div');
    mockElement.contentEditable = 'true';
    document.body.appendChild(mockElement);

    // Create the mock selection service
    mockSelectionService = new MockSelectionService();

    // Create editor instance
    editor = new Editor(mockElement, mockSelectionService);
  });

  afterEach(() => {
    editor.destroy();
    document.body.removeChild(mockElement);
  });

  test('initializes with empty content', () => {
    expect(editor.getValue()).toBe('');
    expect(editor.getHtml()).toBe('');
  });

  test('setValue updates content', () => {
    const testHtml = '<strong>Bold text</strong>';
    editor.setValue(testHtml);

    expect(mockElement.innerHTML).toBe(testHtml);
    expect(editor.getHtml()).toContain('Bold text');
  });

  test('clearValue empties content', () => {
    const onChange = vi.fn();
    editor.onContentChange(onChange);

    // Set some content first
    editor.setValue('<p>Some content</p>');

    // Clear the content
    editor.clearValue();

    expect(editor.getValue()).toBe('');
    expect(mockElement.innerHTML).toBe('');
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('focus delegates to root element', () => {
    const focusSpy = vi.spyOn(mockElement, 'focus');
    editor.focus();
    expect(focusSpy).toHaveBeenCalled();
  });

  test('disable/enable functionality works', () => {
    // Initially should be enabled
    expect(mockElement.contentEditable).toBe('true');

    // Disable the editor
    editor.disable(true);
    expect(mockElement.contentEditable).toBe('false');

    // Re-enable the editor
    editor.disable(false);
    expect(mockElement.contentEditable).toBe('true');
  });

  test('handleInput updates virtual DOM and notifies change', () => {
    const onChange = vi.fn();
    editor.onContentChange(onChange);

    const mockEvent = {
      target: { innerText: 'Hello World' },
    } as unknown as React.FormEvent<HTMLDivElement>;

    const result = editor.handleInput(mockEvent);

    expect(result).toBe(true);
    expect(editor.getValue()).toBe('Hello World');
    expect(onChange).toHaveBeenCalled();
  });

  test('handleInput returns false when disabled', () => {
    editor.disable(true);

    const mockEvent = {
      target: { innerText: 'Hello World' },
    } as unknown as React.FormEvent<HTMLDivElement>;

    const result = editor.handleInput(mockEvent);
    expect(result).toBe(false);
  });

  test('handleKeyDown handles bold shortcut', () => {
    const mockEvent = {
      ctrlKey: true,
      key: 'b',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    // Mock selection with text
    mockSelectionService.setMockSelectedText('selected text');

    const result = editor.handleKeyDown(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  test('handleKeyDown handles italic shortcut', () => {
    const mockEvent = {
      ctrlKey: true,
      key: 'i',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    // Mock selection with text
    mockSelectionService.setMockSelectedText('selected text');

    const result = editor.handleKeyDown(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  test('handleKeyDown handles underline shortcut', () => {
    const mockEvent = {
      ctrlKey: true,
      key: 'u',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    // Mock selection with text
    mockSelectionService.setMockSelectedText('selected text');

    const result = editor.handleKeyDown(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  test('handleKeyDown returns false for non-shortcut keys', () => {
    const mockEvent = {
      ctrlKey: false,
      key: 'a',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    const result = editor.handleKeyDown(mockEvent);

    expect(result).toBe(false);
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  test('handleKeyDown returns false when disabled', () => {
    editor.disable(true);

    const mockEvent = {
      ctrlKey: true,
      key: 'b',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    const result = editor.handleKeyDown(mockEvent);
    expect(result).toBe(false);
  });

  test('handlePaste processes clipboard data', () => {
    const onChange = vi.fn();
    editor.onContentChange(onChange);

    const mockEvent = {
      preventDefault: vi.fn(),
      clipboardData: {
        getData: vi.fn().mockReturnValue('pasted text'),
      },
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = editor.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockElement.innerHTML).toContain('<p>pasted text</p>');
    expect(onChange).toHaveBeenCalled();
  });

  test('handlePaste returns false when disabled', () => {
    editor.disable(true);

    const mockEvent = {
      preventDefault: vi.fn(),
      clipboardData: {
        getData: vi.fn().mockReturnValue('pasted text'),
      },
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = editor.handlePaste(mockEvent);
    expect(result).toBe(false);
  });

  test('handlePaste wraps single line text in paragraph', () => {
    const onChange = vi.fn();
    editor.onContentChange(onChange);

    const mockEvent = {
      preventDefault: vi.fn(),
      clipboardData: {
        getData: vi.fn().mockReturnValue('single line text'),
      },
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = editor.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();

    // Should wrap pasted text in paragraph
    const html = editor.getHtml();
    expect(html).toContain('<p>single line text</p>');
  });

  test('handlePaste creates multiple paragraphs for multi-line text', () => {
    const onChange = vi.fn();
    editor.onContentChange(onChange);

    const multiLineText = 'First line\nSecond line\nThird line';
    const mockEvent = {
      preventDefault: vi.fn(),
      clipboardData: {
        getData: vi.fn().mockReturnValue(multiLineText),
      },
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = editor.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();

    // Should create multiple paragraphs
    const html = editor.getHtml();
    expect(html).toContain('<p>First line</p>');
    expect(html).toContain('<p>Second line</p>');
    expect(html).toContain('<p>Third line</p>');
  });

  test('handlePaste preserves existing paragraph structure', () => {
    const onChange = vi.fn();
    editor.onContentChange(onChange);

    // Set initial content with existing paragraphs
    editor.setValue('<p>Existing paragraph</p>');

    const mockEvent = {
      preventDefault: vi.fn(),
      clipboardData: {
        getData: vi.fn().mockReturnValue('pasted text'),
      },
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = editor.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();

    // Should preserve existing content and add new paragraph
    const html = editor.getHtml();
    expect(html).toContain('<p>Existing paragraph</p>');
    expect(html).toContain('<p>pasted text</p>');
  });

  test('handlePaste handles empty clipboard data gracefully', () => {
    const onChange = vi.fn();
    editor.onContentChange(onChange);

    const mockEvent = {
      preventDefault: vi.fn(),
      clipboardData: {
        getData: vi.fn().mockReturnValue(''),
      },
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = editor.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    // onChange should not be called for empty paste
    expect(onChange).not.toHaveBeenCalled();
  });

  test('change listener registration and removal works', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    editor.onContentChange(listener1);
    editor.onContentChange(listener2);

    // Trigger change through handleInput (which calls notifyChange)
    const mockEvent = {
      target: { innerText: 'Test content' },
    } as unknown as React.FormEvent<HTMLDivElement>;

    editor.handleInput(mockEvent);

    // Both listeners should be called
    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();

    // Remove one listener
    editor.removeContentChangeListener(listener1);

    listener1.mockClear();
    listener2.mockClear();

    // Trigger change again
    const mockEvent2 = {
      target: { innerText: 'Test content 2' },
    } as unknown as React.FormEvent<HTMLDivElement>;

    editor.handleInput(mockEvent2);

    // Only listener2 should be called
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });

  test('getCurrentState returns current FSM state', () => {
    const state = editor.getCurrentState();
    expect(state).toBeDefined();
  });

  test('destroy cleans up change listeners', () => {
    const listener = vi.fn();
    editor.onContentChange(listener);

    editor.destroy();

    // Listeners should be cleared after destroy is called
    editor.setValue('<p>Test</p>');
    expect(listener).not.toHaveBeenCalled();
  });

  describe('paragraph handling', () => {
    test('handleKeyDown handles Enter key for paragraph creation', () => {
      const onChange = vi.fn();
      editor.onContentChange(onChange);

      // Set initial content with a paragraph
      editor.setValue('<p>Hello world</p>');

      // Mock cursor position in middle of paragraph
      mockSelectionService.setMockCursorPosition(5); // After "Hello"

      const mockEvent = {
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = editor.handleKeyDown(mockEvent);

      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();

      // Should create two paragraphs
      const html = editor.getHtml();
      expect(html).toContain('<p>Hello</p>');
      expect(html).toContain('<p> world</p>');
    });

    test('handleKeyDown handles Enter key at beginning of paragraph', () => {
      const onChange = vi.fn();
      editor.onContentChange(onChange);

      editor.setValue('<p>Hello world</p>');
      mockSelectionService.setMockCursorPosition(0); // At beginning

      const mockEvent = {
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = editor.handleKeyDown(mockEvent);

      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Should create empty paragraph before existing content
      const html = editor.getHtml();
      expect(html).toContain('<p></p>');
      expect(html).toContain('<p>Hello world</p>');
    });

    test('handleKeyDown handles Enter key at end of paragraph', () => {
      const onChange = vi.fn();
      editor.onContentChange(onChange);

      editor.setValue('<p>Hello world</p>');
      mockSelectionService.setMockCursorPosition(11); // At end

      const mockEvent = {
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = editor.handleKeyDown(mockEvent);

      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Should create new empty paragraph after existing content
      const html = editor.getHtml();
      expect(html).toContain('<p>Hello world</p>');
      expect(html).toContain(`<p>${ZERO_WIDTH_SPACE}</p>`); // Empty paragraphs contain zero-width-space
    });

    test('handleKeyDown handles Backspace key for paragraph merging', () => {
      const onChange = vi.fn();
      editor.onContentChange(onChange);

      // Set content with two paragraphs
      editor.setValue('<p>First paragraph</p><p>Second paragraph</p>');

      // Mock cursor at beginning of second paragraph
      mockSelectionService.setMockCursorPosition(15); // Beginning of "Second"

      const mockEvent = {
        key: 'Backspace',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = editor.handleKeyDown(mockEvent);

      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();

      // Should merge paragraphs
      const html = editor.getHtml();
      expect(html).toContain('<p>First paragraphSecond paragraph</p>');
    });

    test('handleKeyDown handles Delete key for paragraph merging', () => {
      const onChange = vi.fn();
      editor.onContentChange(onChange);

      // Set content with two paragraphs
      editor.setValue('<p>First paragraph</p><p>Second paragraph</p>');

      // Mock cursor at end of first paragraph
      mockSelectionService.setMockCursorPosition(14); // End of "First paragraph" (position 14)

      const mockEvent = {
        key: 'Delete',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = editor.handleKeyDown(mockEvent);

      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();

      // Should merge paragraphs
      const html = editor.getHtml();
      expect(html).toContain('<p>First paragraphSecond paragraph</p>');
    });

    test('handleKeyDown preserves formatting when splitting paragraphs', () => {
      const onChange = vi.fn();
      editor.onContentChange(onChange);

      // Set content with formatted text
      editor.setValue('<p>Hello <strong>bold</strong> world</p>');

      // Mock cursor position in middle of bold text
      mockSelectionService.setMockCursorPosition(8); // In "bold"

      const mockEvent = {
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = editor.handleKeyDown(mockEvent);

      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Should preserve formatting in split paragraphs
      const html = editor.getHtml();
      expect(html).toContain('<strong>');
      expect(html).toContain('</strong>');
    });

    test('handleKeyDown returns false for paragraph operations when disabled', () => {
      editor.disable(true);

      const mockEvent = {
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = editor.handleKeyDown(mockEvent);
      expect(result).toBe(false);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    // Tests for the specific scenarios mentioned in the issue description
    describe('Enter key with formatting preservation', () => {
      test('Enter at beginning of formatted text should prepend empty paragraph', () => {
        const onChange = vi.fn();
        editor.onContentChange(onChange);

        // Set content with formatted text
        editor.setValue('<p><strong>Bold text</strong> and normal text</p>');

        // Mock cursor at beginning of the paragraph (before "Bold")
        mockSelectionService.setMockCursorPosition(0);

        const mockEvent = {
          key: 'Enter',
          ctrlKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;

        const result = editor.handleKeyDown(mockEvent);

        expect(result).toBe(true);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalled();

        // Should create empty paragraph before existing content
        const html = editor.getHtml();
        expect(html).toContain('<p></p>'); // Empty paragraph first
        expect(html).toContain('<p><strong>Bold text</strong> and normal text</p>'); // Original content preserved
      });

      test('Enter at end of formatted text should append empty paragraph', () => {
        const onChange = vi.fn();
        editor.onContentChange(onChange);

        // Set content with formatted text
        editor.setValue('<p>Normal text and <strong>bold text</strong></p>');

        // Mock cursor at end of the paragraph (after "bold text")
        mockSelectionService.setMockCursorPosition(25); // At end of paragraph

        const mockEvent = {
          key: 'Enter',
          ctrlKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;

        const result = editor.handleKeyDown(mockEvent);

        expect(result).toBe(true);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalled();

        // Should create empty paragraph after existing content
        const html = editor.getHtml();
        expect(html).toContain('<p>Normal text and <strong>bold text</strong></p>'); // Original content preserved
        expect(html).toContain(`<p>${ZERO_WIDTH_SPACE}</p>`); // Empty paragraph after
      });

      test('Enter in middle of formatted text should split with formatting preserved', () => {
        const onChange = vi.fn();
        editor.onContentChange(onChange);

        // Set content with formatted text
        editor.setValue('<p><strong>Hello world</strong></p>');

        // Mock cursor in middle of "Hello world" (between "Hello" and " world")
        mockSelectionService.setMockCursorPosition(5); // After "Hello"

        const mockEvent = {
          key: 'Enter',
          ctrlKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;

        const result = editor.handleKeyDown(mockEvent);

        expect(result).toBe(true);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalled();

        // Should split the formatted text properly
        const html = editor.getHtml();
        expect(html).toContain('<p><strong>Hello</strong></p>'); // First paragraph with formatting
        expect(html).toContain('<p><strong> world</strong></p>'); // Second paragraph with formatting
      });

      test('Enter in middle of mixed formatting should preserve all formatting', () => {
        const onChange = vi.fn();
        editor.onContentChange(onChange);

        // Set content with mixed formatting
        editor.setValue('<p>Normal <strong>bold</strong> and <em>italic</em> text</p>');

        // Mock cursor between "bold" and " and" (after the </strong> tag)
        mockSelectionService.setMockCursorPosition(11); // After "bold"

        const mockEvent = {
          key: 'Enter',
          ctrlKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;

        const result = editor.handleKeyDown(mockEvent);

        expect(result).toBe(true);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalled();

        // Should split while preserving all formatting
        const html = editor.getHtml();
        expect(html).toContain('<p>Normal <strong>bold</strong></p>'); // First paragraph
        expect(html).toContain('<p> and <em>italic</em> text</p>'); // Second paragraph
      });

      test('Enter in middle of nested formatting should preserve nesting', () => {
        const onChange = vi.fn();
        editor.onContentChange(onChange);

        // Set content with nested formatting (bold + italic)
        editor.setValue('<p><strong><em>Bold italic text</em></strong></p>');

        // Mock cursor in middle of "Bold italic text" (between "Bold" and " italic")
        mockSelectionService.setMockCursorPosition(4); // After "Bold"

        const mockEvent = {
          key: 'Enter',
          ctrlKey: false,
          metaKey: false,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;

        const result = editor.handleKeyDown(mockEvent);

        expect(result).toBe(true);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(onChange).toHaveBeenCalled();

        // Should split while preserving nested formatting
        const html = editor.getHtml();
        expect(html).toContain('<p><strong><em>Bold</em></strong></p>'); // First paragraph with nested formatting
        expect(html).toContain('<p><strong><em> italic text</em></strong></p>'); // Second paragraph with nested formatting
      });
    });
  });
});
