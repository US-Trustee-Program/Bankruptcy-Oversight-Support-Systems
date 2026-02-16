import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { handleHighlight } from './highlight-api';

describe('CSS Highlight API integration', () => {
  const defaultTestDom = new JSDOM(`
    <html lang="en-us">
    <head></head>
    <body>
      <div id='searchable-docket'>
        <div>
          <div>This is some summary text.</div>
          <div>This is docket entry full text.</div>
        </div>
      </div>
    </body>
    </html>
  `);

  let highlightConstructorMock: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

  beforeEach(() => {
    highlightConstructorMock = vi.fn<(...args: unknown[]) => void>();
    class Highlight {
      constructor(...args: unknown[]) {
        highlightConstructorMock(...args);
      }
    }
    vi.stubGlobal('Highlight', Highlight);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('should clear highlights if no search term is passed', () => {
    const setMock = vi.fn();
    const clearMock = vi.fn();
    const { window } = defaultTestDom;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    const searchString = '';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(clearMock).toHaveBeenCalled();
  });

  test('should not add highlights if the specified element is not available', () => {
    const dom = new JSDOM(`
      <html lang="en-us">
      <head></head>
      <body></body>
      </html>
      `);

    const setMock = vi.fn();
    const clearMock = vi.fn();
    const { window } = dom;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    const searchString = 'Docket';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(setMock).not.toHaveBeenCalled();
  });

  test('should not add highlights if browser does not support CSS.highlights', () => {
    const { window } = defaultTestDom;
    window.CSS = {
      highlights: undefined,
    } as unknown as typeof window.CSS;
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    const searchString = 'Docket';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    // No error should be thrown
  });

  test('should clear highlights if search string is shorter than minSearchStringLength', () => {
    const setMock = vi.fn();
    const clearMock = vi.fn();
    const { window } = defaultTestDom;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    const searchString = 'D';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString, 2);
    expect(clearMock).toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  test('should handle multiple matches in text nodes', () => {
    const setMock = vi.fn();
    const clearMock = vi.fn();
    const { window } = defaultTestDom;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    const searchString = 'Docket';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(setMock).toHaveBeenCalled();
  });

  test('should handle errors gracefully', () => {
    const { window } = defaultTestDom;
    window.CSS = {
      highlights: {
        set: () => {
          throw new Error('Test error');
        },
        clear: () => {},
      },
    };
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    const searchString = 'Docket';
    expect(() => {
      handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    }).not.toThrow();
  });

  test('should handle null or undefined text node content', () => {
    const setMock = vi.fn();
    const clearMock = vi.fn();
    const { window } = defaultTestDom;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    // Create a text node with null content
    const textNode = document.createTextNode('');
    Object.defineProperty(textNode, 'textContent', {
      get: () => null,
    });

    // Replace the content of the first div with our null text node
    const container = document.getElementById('searchable-docket')!;
    const firstDiv = container.querySelector('div')!;
    firstDiv.innerHTML = '';
    firstDiv.appendChild(textNode);

    const searchString = 'Docket';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(setMock).toHaveBeenCalled();
  });

  test('should handle text nodes with no matches', () => {
    const setMock = vi.fn();
    const clearMock = vi.fn();
    const { window } = defaultTestDom;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const { document } = window;

    const searchString = 'docket';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(setMock).toHaveBeenCalled();
    expect(highlightConstructorMock).toHaveBeenCalledWith();
  });
});
