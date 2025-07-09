import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ListNavigationService } from './ListNavigationService';
import { SelectionService } from './SelectionService.humble';
import { ListUtilities } from './ListUtilities';

// This test reproduces how RichTextEditor.tsx handles keydown events
// The goal is to verify the bug is in event handling, not in the core ListNavigationService
describe('KeyboardEvent Integration with ListNavigationService', () => {
  let root: HTMLElement;
  let selectionService: SelectionService;
  let listUtilities: ListUtilities;
  let listNavigationService: ListNavigationService;
  let mockEnterKeydown: KeyboardEvent;

  // Track if event was handled
  let eventHandled = false;

  // Mock the entire keydown handler similar to RichTextEditor.tsx
  const mockRichTextEditorKeyDown = (e: KeyboardEvent) => {
    eventHandled = false;

    // We're only testing Enter key handling here
    if (e.key === 'Enter') {
      // Convert DOM event to React event (simplified)
      const reactKeyboardEvent = {
        key: e.key,
        preventDefault: vi.fn(() => {
          e.preventDefault();
        }),
        stopPropagation: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      // Simulate how RichTextEditor handles the event
      if (listNavigationService.handleEnterKey(reactKeyboardEvent)) {
        eventHandled = true;
        return;
      }
    }
  };

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '';
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.appendChild(root);

    // Create selection service
    selectionService = {
      getCurrentSelection: vi.fn().mockImplementation(() => window.getSelection()),
      getRangeAtStartOfSelection: vi.fn().mockImplementation(() => {
        const selection = window.getSelection();
        return selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      }),
      getSelectedText: vi.fn(),
      createElement: vi.fn((tag) => document.createElement(tag)),
      createTextNode: vi.fn((text) => document.createTextNode(text)),
      createRange: vi.fn(() => document.createRange()),
      setSelectionRange: vi.fn(),
      selectNodeContents: vi.fn(),
      createDocumentFragment: vi.fn(() => document.createDocumentFragment()),
      createTreeWalker: vi.fn(),
    };

    // Create services
    listUtilities = new ListUtilities(root, selectionService);
    listNavigationService = new ListNavigationService(root, selectionService, listUtilities);

    // Reset tracking
    eventHandled = false;

    // Create mock keyboard event
    mockEnterKeydown = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
  });

  it('should handle Enter key on empty ordered list item through DOM events', () => {
    // Set up ordered list with empty item
    root.innerHTML = `
      <ol>
        <li>First item</li>
        <li>Second item</li>
        <li id="emptyItem"></li>
      </ol>
    `;

    const emptyItem = document.getElementById('emptyItem')!;

    // Set selection to empty list item
    const range = document.createRange();
    range.setStart(emptyItem, 0);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Simulate keydown in the RichTextEditor
    mockRichTextEditorKeyDown(mockEnterKeydown);

    // Check that the event was handled
    expect(eventHandled).toBe(true);

    // Check that the empty list item was removed and paragraph added
    const remainingItems = root.querySelectorAll('li');
    expect(remainingItems.length).toBe(2);

    const paragraphAfterList = root.querySelector('ol + p');
    expect(paragraphAfterList).not.toBeNull();
  });

  it('should handle Enter key on empty unordered list item through DOM events', () => {
    // Set up unordered list with empty item
    root.innerHTML = `
      <ul>
        <li>First item</li>
        <li>Second item</li>
        <li id="emptyItem"></li>
      </ul>
    `;

    const emptyItem = document.getElementById('emptyItem')!;

    // Set selection to empty list item
    const range = document.createRange();
    range.setStart(emptyItem, 0);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Simulate keydown in the RichTextEditor
    mockRichTextEditorKeyDown(mockEnterKeydown);

    // Check that the event was handled
    expect(eventHandled).toBe(true);

    // Check that the empty list item was removed and paragraph added
    const remainingItems = root.querySelectorAll('li');
    expect(remainingItems.length).toBe(2);

    const paragraphAfterList = root.querySelector('ul + p');
    expect(paragraphAfterList).not.toBeNull();
  });
});
