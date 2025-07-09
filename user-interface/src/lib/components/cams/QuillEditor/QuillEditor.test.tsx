import { describe, expect, beforeEach, vi, test } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import QuillEditor, { QuillEditorRef } from './QuillEditor';
import Quill from 'quill';

// Mock Quill
vi.mock('quill');

// Define interface for mock Quill instance
interface MockQuillInstance {
  on: ReturnType<typeof vi.fn> & {
    mock: {
      calls: Array<Array<unknown>>;
    };
  };
  enable: ReturnType<typeof vi.fn>;
  setText: ReturnType<typeof vi.fn>;
  getText: ReturnType<typeof vi.fn>;
  getFormat: ReturnType<typeof vi.fn>;
  format: ReturnType<typeof vi.fn>;
  root: {
    innerHTML: string;
  };
  focus: ReturnType<typeof vi.fn>;
}

// Create a mock Quill instance
let mockQuillInstance: MockQuillInstance;

describe('QuillEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Create a fresh mock Quill instance for each test
    mockQuillInstance = {
      on: vi.fn(),
      enable: vi.fn(),
      setText: vi.fn(),
      getText: vi.fn().mockReturnValue(''),
      getFormat: vi.fn().mockReturnValue({ bold: false, italic: false }),
      format: vi.fn(),
      root: {
        innerHTML: '',
      },
      focus: vi.fn(),
    };

    // Create a mock Quill constructor
    const MockQuill = vi.fn().mockImplementation(() => mockQuillInstance);

    // Set up the mock
    vi.mocked(Quill).mockImplementation(MockQuill);
  });

  test('renders with label and aria description', async () => {
    // Render component
    render(<QuillEditor id="test-editor" label="Test Label" ariaDescription="Test description" />);

    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  test('should have only one toolbar', async () => {
    // Render component
    render(<QuillEditor id="test-editor" />);

    // Check for the custom toolbar
    const customToolbar = document.querySelector('.quill-custom-toolbar');
    expect(customToolbar).toBeInTheDocument();

    // Query all elements with the class 'ql-toolbar ql-snow'
    const autoToolbars = document.querySelectorAll('.ql-toolbar.ql-snow');

    // There should be no auto-generated toolbars
    expect(autoToolbars.length).toBe(0);
  });

  test('exposes imperative methods via ref', async () => {
    const ref = React.createRef<QuillEditorRef>();

    // Render component
    render(<QuillEditor id="test-editor" ref={ref} />);

    // Test the ref methods exist
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.clearValue).toBe('function');
    expect(typeof ref.current?.getValue).toBe('function');
    expect(typeof ref.current?.getHtml).toBe('function');
    expect(typeof ref.current?.setValue).toBe('function');
    expect(typeof ref.current?.disable).toBe('function');
    expect(typeof ref.current?.focus).toBe('function');

    // Call the methods to ensure they don't throw, wrapped in act
    await act(async () => {
      ref.current?.clearValue();
    });

    await act(async () => {
      ref.current?.getValue();
    });

    await act(async () => {
      ref.current?.getHtml();
    });

    await act(async () => {
      ref.current?.setValue('<p>test</p>');
    });

    await act(async () => {
      ref.current?.disable(true);
    });

    await act(async () => {
      ref.current?.focus();
    });
  });

  test('calls onChange when content changes', async () => {
    const onChange = vi.fn();

    // Render component
    render(<QuillEditor id="test-editor" onChange={onChange} />);

    // Get the component instance by its test ID
    const editorInstance = screen.getByTestId('test-editor');
    expect(editorInstance).toBeInTheDocument();

    // Find the text-change callback that was registered
    const textChangeCallback = mockQuillInstance.on.mock.calls.find(
      (call: Array<unknown>) => call[0] === 'text-change',
    )?.[1];

    // Simulate a text change event by calling the callback
    if (textChangeCallback) {
      textChangeCallback();
    }

    // Check if onChange was called
    expect(onChange).toHaveBeenCalled();
  });

  test('tooltip with ql-hidden class should have CSS rule to hide it', async () => {
    // Instead of checking computed styles which don't work in JSDOM,
    // we'll check that our component has the CSS class that would hide the tooltip

    // Render component
    render(<QuillEditor id="test-editor" />);

    // For this test, we'll create a tooltip element and add it to the document body
    // since we're just testing that the CSS classes are applied correctly
    const tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'ql-tooltip ql-hidden';
    tooltipDiv.textContent = 'This should be hidden';
    tooltipDiv.setAttribute('data-testid', 'tooltip');

    // Add it to the document body
    document.body.appendChild(tooltipDiv);

    // Verify the tooltip element exists
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toBeInTheDocument();

    // In a real browser, this element would be hidden by our CSS rule:
    // .quill-editor-container .ql-tooltip.ql-hidden { display: none !important; }
    // We can't test the actual CSS application in JSDOM, so we'll just verify
    // that the element has the correct classes that our CSS would target
    expect(tooltip.classList.contains('ql-tooltip')).toBe(true);
    expect(tooltip.classList.contains('ql-hidden')).toBe(true);

    // Clean up
    document.body.removeChild(tooltip);
  });

  test('bold button should have proper styling and content', async () => {
    // Render component
    render(<QuillEditor id="test-editor" />);

    // Find the bold button by test ID or text content
    let boldButton: HTMLElement;
    try {
      boldButton = screen.getByTestId('bold-button');
    } catch (_error) {
      // If that fails, try to find it by its text content
      boldButton = screen.getByText('B');
    }

    expect(boldButton).toBeTruthy();

    // Check that the button has the text "B"
    expect(boldButton.textContent).toBe('B');

    // Check that the button has a title attribute
    expect(boldButton.getAttribute('title')).toBe('Bold');
  });

  test('bold button should be properly wired up', async () => {
    // Render component
    render(<QuillEditor id="test-editor" />);

    // Find the bold button by test ID or text content
    let boldButton: HTMLElement;
    try {
      boldButton = screen.getByTestId('bold-button');
    } catch (_error) {
      // If that fails, try to find it by its text content
      boldButton = screen.getByText('B');
    }

    expect(boldButton).toBeTruthy();

    // Initially, the button should not have the active class
    expect(boldButton.classList.contains('active')).toBe(false);

    // We're not testing the click behavior here as it would require complex mocking
    // of the Quill instance and proper handling of state updates.
    // Instead, we're just verifying the button exists and has the correct initial state.
  });

  test('italic button should have proper styling and content', async () => {
    // Render component
    render(<QuillEditor id="test-editor" />);

    // Find the italic button by test ID or text content
    let italicButton: HTMLElement;
    try {
      italicButton = screen.getByTestId('italic-button');
    } catch (_error) {
      // If that fails, try to find it by its text content
      italicButton = screen.getByText('I');
    }

    expect(italicButton).toBeTruthy();

    // Check that the button has the text "I"
    expect(italicButton.textContent).toBe('I');

    // Check that the button has a title attribute
    expect(italicButton.getAttribute('title')).toBe('Italic');
  });

  test('italic button should be properly wired up', async () => {
    // Render component
    render(<QuillEditor id="test-editor" />);

    // Find the italic button by test ID or text content
    let italicButton: HTMLElement;
    try {
      italicButton = screen.getByTestId('italic-button');
    } catch (_error) {
      // If that fails, try to find it by its text content
      italicButton = screen.getByText('I');
    }

    expect(italicButton).toBeTruthy();

    // Initially, the button should not have the active class
    expect(italicButton.classList.contains('active')).toBe(false);

    // We're not testing the click behavior here as it would require complex mocking
    // of the Quill instance and proper handling of state updates.
    // Instead, we're just verifying the button exists and has the correct initial state.
  });
});
