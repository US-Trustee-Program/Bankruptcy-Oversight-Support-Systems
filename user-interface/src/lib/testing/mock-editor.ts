import { vi } from 'vitest';

// Type definitions for the mock editor
interface MockEditorCommands {
  focus: ReturnType<typeof vi.fn>;
  clearContent: ReturnType<typeof vi.fn>;
  setContent: ReturnType<typeof vi.fn>;
}

export interface MockEditor {
  getHTML: ReturnType<typeof vi.fn>;
  getText: ReturnType<typeof vi.fn>;
  setContent: ReturnType<typeof vi.fn>;
  clearContent: ReturnType<typeof vi.fn>;
  setEditable: ReturnType<typeof vi.fn>;
  commands: MockEditorCommands;
  isEditable: boolean;
  onUpdate: (...args: unknown[]) => void;
  chain: (...args: unknown[]) => {
    focus: (...args: unknown[]) => {
      toggleBold: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleItalic: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleUnderline: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleOrderedList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleBulletList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleLink: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      insertContent: (...args: unknown[]) => { run: (...args: unknown[]) => void };
    };
  };
  isActive: (mark: string) => boolean;
  getAttributes: (type: string) => { href: string; text: string };
  insertContent: (html: string) => { run: (...args: unknown[]) => void };
  state: {
    selection: {
      empty: boolean;
      from: number;
      to: number;
    };
    doc: {
      textBetween: (from: number, to: number, separator: string) => string;
    };
  };
}

// Test data for parameterized tests
export const FORMATTING_BUTTONS = [
  {
    name: 'Bold',
    title: 'Bold (Ctrl+B)',
    command: 'toggleBold',
    mark: 'bold',
    display: 'B',
    testId: 'rich-text-bold-button',
  },
  {
    name: 'Italic',
    title: 'Italic (Ctrl+I)',
    command: 'toggleItalic',
    mark: 'italic',
    display: 'I',
    testId: 'rich-text-italic-button',
  },
  {
    name: 'Underline',
    title: 'Underline (Ctrl+U)',
    command: 'toggleUnderline',
    mark: 'underline',
    display: 'U',
    testId: 'rich-text-underline-button',
  },
] as const;

export const LIST_BUTTONS = [
  {
    name: 'Ordered List',
    command: 'toggleOrderedList',
    mark: 'orderedList',
    testId: 'rich-text-ordered-list-button',
  },
  {
    name: 'Bullet List',
    command: 'toggleBulletList',
    mark: 'bulletList',
    testId: 'rich-text-unordered-list-button',
  },
] as const;

// Mock editor factory function
export function createMockEditor(): MockEditor {
  const mockOnUpdate = vi.fn();
  const mockDocTextBetween = vi.fn().mockReturnValue('');

  const mockEditor: MockEditor = {
    getHTML: vi.fn().mockReturnValue('<p>test content</p>'),
    getText: vi.fn().mockReturnValue('test content'),
    setContent: vi.fn(),
    clearContent: vi.fn(),
    setEditable: vi.fn((val: boolean) => {
      mockEditor.isEditable = val;
    }),
    commands: {
      focus: vi.fn(),
      clearContent: vi.fn(),
      setContent: vi.fn(),
    },
    isEditable: true,
    onUpdate: (...args: unknown[]) => mockOnUpdate(...args),
    chain: vi.fn(() => ({
      focus: vi.fn(() => ({
        toggleBold: vi.fn(() => ({ run: vi.fn() })),
        toggleItalic: vi.fn(() => ({ run: vi.fn() })),
        toggleUnderline: vi.fn(() => ({ run: vi.fn() })),
        toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
        toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
        toggleLink: vi.fn(() => ({ run: vi.fn() })),
        insertContent: vi.fn((...args: unknown[]) => {
          // Simulate inserting a link for test assertions
          const html = typeof args[0] === 'string' ? args[0] : '';
          mockEditor.getHTML.mockReturnValue(`<p>${html}</p>`);
          // Extract text between > and < for getText
          const match = html.match(/>(.*?)<\/a>/);
          mockEditor.getText.mockReturnValue(match ? match[1] : html);
          return { run: vi.fn() };
        }),
      })),
    })),
    isActive: vi.fn(() => false),
    getAttributes: vi.fn((_type: string) => {
      // Always return an object with href and text as strings
      return { href: '', text: '' };
    }),
    insertContent: vi.fn((html: string) => {
      // Simulate inserting a link for test assertions
      mockEditor.getHTML.mockReturnValue(`<p>${html}</p>`);
      // Extract text between > and < for getText
      const match = html.match(/>(.*?)<\/a>/);
      mockEditor.getText.mockReturnValue(match ? match[1] : html);
      return { run: vi.fn() };
    }),
    state: {
      selection: {
        empty: true,
        from: 0,
        to: 0,
      },
      doc: {
        textBetween: mockDocTextBetween,
      },
    },
  };

  return mockEditor;
}

// Helper function to reset mock editor to default state
export function resetMockEditor(mockEditor: MockEditor): void {
  // Reset all mock functions
  Object.values(mockEditor).forEach((value) => {
    if (value && typeof value === 'object' && 'mockReset' in value) {
      (value as ReturnType<typeof vi.fn>).mockReset();
    }
  });

  Object.values(mockEditor.commands).forEach((value) => {
    if (value && typeof value === 'object' && 'mockReset' in value) {
      (value as ReturnType<typeof vi.fn>).mockReset();
    }
  });

  // Reset to default state
  mockEditor.isEditable = true;
  mockEditor.getHTML.mockReturnValue('<p>test content</p>');
  mockEditor.getText.mockReturnValue('test content');
  (mockEditor.isActive as ReturnType<typeof vi.fn>).mockReturnValue(false);
  (mockEditor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({ href: '', text: '' });
  mockEditor.state.selection.empty = true;
  mockEditor.state.selection.from = 0;
  mockEditor.state.selection.to = 0;
  (mockEditor.state.doc.textBetween as ReturnType<typeof vi.fn>).mockReturnValue('');
}
