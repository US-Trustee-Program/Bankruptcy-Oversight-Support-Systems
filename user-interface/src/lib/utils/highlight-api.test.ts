import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { handleHighlight } from './highlight-api';

describe('CSS Highlight API integration', () => {
  test('should clear highlights if no search term is passed', () => {
    const dom = new JSDOM(`
      <html>
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

    const setMock = vi.fn();
    const clearMock = vi.fn();
    const window = dom.window;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const document = window.document;

    // We have to stub out the Highlight class declaration and add it to global scope.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class Highlight {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_props: unknown) {}
    }
    vi.stubGlobal('Highlight', Highlight);

    const searchString = '';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(clearMock).toHaveBeenCalled();
  });

  test('should not add highlights if the specified element is not available', () => {
    const dom = new JSDOM(`
      <html>
      <head></head>
      <body></body>
      </html>
      `);

    const setMock = vi.fn();
    const clearMock = vi.fn();
    const window = dom.window;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const document = window.document;

    // We have to stub out the Highlight class declaration and add it to global scope.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class Highlight {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_props: unknown) {}
    }
    vi.stubGlobal('Highlight', Highlight);

    const searchString = 'Docket';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(setMock).not.toHaveBeenCalled();
  });

  // TODO: Test API available, has search term, but docket does not exist in DOM.
  test('should add highlight to the hightlight API', () => {
    const dom = new JSDOM(`
      <html>
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

    const setMock = vi.fn();
    const clearMock = vi.fn();
    const window = dom.window;
    window.CSS = {
      highlights: {
        set: setMock,
        clear: clearMock,
      },
    };
    const typeCastWindow = window as unknown as Window;
    const document = window.document;

    // We have to stub out the Highlight class declaration and add it to global scope.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class Highlight {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_props: unknown) {}
    }
    vi.stubGlobal('Highlight', Highlight);

    const searchString = 'Docket';
    handleHighlight(typeCastWindow, document, 'searchable-docket', searchString);
    expect(setMock).toHaveBeenCalled();
  });
});
