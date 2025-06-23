export interface SelectionService {
  getCurrentSelection(): Selection | null;
  getRangeAtStartOfSelection(): Range | undefined;
  createRange(): Range;
  setSelectionRange(range: Range): void;
  getSelectedText(): string;
  selectNodeContents(node: Node): void;
  createElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
  createTextNode(text: string): Text;
  createDocumentFragment(): DocumentFragment;
  createTreeWalker(root: Node, whatToShow: number, filter?: NodeFilter | null): TreeWalker;
}

export class BrowserSelectionService implements SelectionService {
  private window: Window;
  private document: Document;

  constructor(window: Window, document: Document) {
    this.window = window;
    this.document = document;
  }

  getCurrentSelection(): Selection | null {
    return this.window.getSelection();
  }

  createRange(): Range {
    return this.document.createRange();
  }

  setSelectionRange(range: Range): void {
    const selection = this.getCurrentSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  getRangeAtStartOfSelection(): Range | undefined {
    const selection = this.getCurrentSelection();
    return selection ? selection.getRangeAt(0) : undefined;
  }

  getSelectedText(): string {
    const selection = this.getCurrentSelection();
    return selection ? selection.toString() : '';
  }

  selectNodeContents(node: Node): void {
    const range = this.createRange();
    range.selectNodeContents(node);
    this.setSelectionRange(range);
  }

  createElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] {
    return this.document.createElement(tagName);
  }

  createTextNode(text: string): Text {
    return this.document.createTextNode(text);
  }

  createDocumentFragment(): DocumentFragment {
    return this.document.createDocumentFragment();
  }

  createTreeWalker(root: Node, whatToShow: number, filter?: NodeFilter | null): TreeWalker {
    return this.document.createTreeWalker(root, whatToShow, filter);
  }
}

export class MockSelectionService implements SelectionService {
  private mockSelection: {
    rangeCount: number;
    ranges: Range[];
    text: string;
  } = {
    rangeCount: 0,
    ranges: [],
    text: '',
  };

  getCurrentSelection(): Selection {
    // Return a mock Selection object that delegates to the real window.getSelection() when needed
    // but allows us to control the behavior for testing
    const realSelection = window.getSelection();

    return {
      rangeCount:
        this.mockSelection.rangeCount > 0
          ? this.mockSelection.rangeCount
          : realSelection?.rangeCount || 0,
      getRangeAt: (index: number) => {
        if (this.mockSelection.ranges.length > 0) {
          return this.mockSelection.ranges[index];
        }
        return realSelection?.getRangeAt(index) || document.createRange();
      },
      removeAllRanges: () => {
        this.mockSelection.ranges = [];
        this.mockSelection.rangeCount = 0;
        realSelection?.removeAllRanges();
      },
      addRange: (range: Range) => {
        this.mockSelection.ranges.push(range);
        this.mockSelection.rangeCount = this.mockSelection.ranges.length;
        realSelection?.addRange(range);
      },
      toString: () => this.mockSelection.text || realSelection?.toString() || '',
      // Other Selection methods would be implemented as needed
    } as unknown as Selection;
  }

  createRange(): Range {
    // Use the actual document.createRange() for more realistic behavior in tests
    return document.createRange();
  }

  setSelectionRange(range: Range): void {
    const selection = this.getCurrentSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  getRangeAtStartOfSelection(): Range | undefined {
    return this.getCurrentSelection()?.getRangeAt(0) || undefined;
  }

  getSelectedText(): string {
    return this.mockSelection.text;
  }

  selectNodeContents(node: Node): void {
    const range = this.createRange();
    range.selectNodeContents(node);
    this.setSelectionRange(range);
  }

  // Helper methods for tests
  setMockSelectedText(text: string): void {
    this.mockSelection.text = text;
  }

  createElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] {
    // A simple mock implementation. May need to be more sophisticated depending on tests.
    return document.createElement(tagName);
  }

  createTextNode(text: string): Text {
    return document.createTextNode(text);
  }

  createDocumentFragment(): DocumentFragment {
    return document.createDocumentFragment();
  }

  createTreeWalker(root: Node, whatToShow: number, filter?: NodeFilter | null): TreeWalker {
    // This is harder to mock without a full DOM. For now, we'll assume JSDOM provides `document`.
    return document.createTreeWalker(root, whatToShow, filter);
  }
}
