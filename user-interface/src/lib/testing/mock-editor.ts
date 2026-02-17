import { vi } from 'vitest';

// Type definitions for the mock editor
interface MockEditorCommands {
  focus: ReturnType<typeof vi.fn<() => void>>;
  clearContent: ReturnType<typeof vi.fn<() => void>>;
  setContent: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
}

export interface MockEditor {
  getHTML: ReturnType<typeof vi.fn<() => string | null>>;
  getText: ReturnType<typeof vi.fn<() => string | null>>;
  setContent: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  clearContent: ReturnType<typeof vi.fn<() => void>>;
  setEditable: ReturnType<typeof vi.fn<(val: boolean) => void>>;
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
  const mockOnUpdate = vi.fn<(...args: unknown[]) => void>();
  const mockDocTextBetween = vi
    .fn<(from: number, to: number, separator: string) => string>()
    .mockReturnValue('');

  const mockEditor: MockEditor = {
    getHTML: vi.fn<() => string | null>().mockReturnValue('<p>test content</p>'),
    getText: vi.fn<() => string | null>().mockReturnValue('test content'),
    setContent: vi.fn<(...args: unknown[]) => void>(),
    clearContent: vi.fn<() => void>(),
    setEditable: vi.fn<(val: boolean) => void>((val: boolean) => {
      mockEditor.isEditable = val;
    }),
    commands: {
      focus: vi.fn<() => void>(),
      clearContent: vi.fn<() => void>(),
      setContent: vi.fn<(...args: unknown[]) => void>(),
    },
    isEditable: true,
    onUpdate: (...args: unknown[]) => mockOnUpdate(...args),
    chain: vi.fn<
      (...args: unknown[]) => {
        focus: (...args: unknown[]) => {
          toggleBold: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleItalic: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleUnderline: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleOrderedList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleBulletList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleLink: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          insertContent: (...args: unknown[]) => { run: (...args: unknown[]) => void };
        };
      }
    >(() => ({
      focus: vi.fn<
        (...args: unknown[]) => {
          toggleBold: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleItalic: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleUnderline: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleOrderedList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleBulletList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          toggleLink: (...args: unknown[]) => { run: (...args: unknown[]) => void };
          insertContent: (...args: unknown[]) => { run: (...args: unknown[]) => void };
        }
      >(() => ({
        toggleBold: vi.fn<(...args: unknown[]) => { run: (...args: unknown[]) => void }>(() => ({
          run: vi.fn<(...args: unknown[]) => void>(),
        })),
        toggleItalic: vi.fn<(...args: unknown[]) => { run: (...args: unknown[]) => void }>(() => ({
          run: vi.fn<(...args: unknown[]) => void>(),
        })),
        toggleUnderline: vi.fn<(...args: unknown[]) => { run: (...args: unknown[]) => void }>(
          () => ({ run: vi.fn<(...args: unknown[]) => void>() }),
        ),
        toggleOrderedList: vi.fn<(...args: unknown[]) => { run: (...args: unknown[]) => void }>(
          () => ({ run: vi.fn<(...args: unknown[]) => void>() }),
        ),
        toggleBulletList: vi.fn<(...args: unknown[]) => { run: (...args: unknown[]) => void }>(
          () => ({ run: vi.fn<(...args: unknown[]) => void>() }),
        ),
        toggleLink: vi.fn<(...args: unknown[]) => { run: (...args: unknown[]) => void }>(() => ({
          run: vi.fn<(...args: unknown[]) => void>(),
        })),
        insertContent: vi.fn<(...args: unknown[]) => { run: (...args: unknown[]) => void }>(
          (...args: unknown[]) => {
            // Simulate inserting a link for test assertions
            const html = typeof args[0] === 'string' ? args[0] : '';
            mockEditor.getHTML.mockReturnValue(`<p>${html}</p>`);
            // Extract text between > and < for getText
            const match = html.match(/>(.*?)<\/a>/);
            mockEditor.getText.mockReturnValue(match ? match[1] : html);
            return { run: vi.fn<(...args: unknown[]) => void>() };
          },
        ),
      })),
    })),
    isActive: vi.fn<(mark: string) => boolean>(() => false),
    getAttributes: vi.fn<(type: string) => { href: string; text: string }>((_type: string) => {
      // Always return an object with href and text as strings
      return { href: '', text: '' };
    }),
    insertContent: vi.fn<(html: string) => { run: (...args: unknown[]) => void }>(
      (html: string) => {
        // Simulate inserting a link for test assertions
        mockEditor.getHTML.mockReturnValue(`<p>${html}</p>`);
        // Extract text between > and < for getText
        const match = html.match(/>(.*?)<\/a>/);
        mockEditor.getText.mockReturnValue(match ? match[1] : html);
        return { run: vi.fn<(...args: unknown[]) => void>() };
      },
    ),
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
      (value as ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>).mockReset();
    }
  });

  Object.values(mockEditor.commands).forEach((value) => {
    if (value && typeof value === 'object' && 'mockReset' in value) {
      (value as ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>).mockReset();
    }
  });

  // Reset to default state
  mockEditor.isEditable = true;
  mockEditor.getHTML.mockReturnValue('<p>test content</p>');
  mockEditor.getText.mockReturnValue('test content');
  (mockEditor.isActive as ReturnType<typeof vi.fn<(mark: string) => boolean>>).mockReturnValue(
    false,
  );
  (
    mockEditor.getAttributes as ReturnType<
      typeof vi.fn<(type: string) => { href: string; text: string }>
    >
  ).mockReturnValue({ href: '', text: '' });
  mockEditor.state.selection.empty = true;
  mockEditor.state.selection.from = 0;
  mockEditor.state.selection.to = 0;
  (
    mockEditor.state.doc.textBetween as ReturnType<
      typeof vi.fn<(from: number, to: number, separator: string) => string>
    >
  ).mockReturnValue('');
}
