import WindowExperimental = BrowserExperimental.WindowExperimental;

export function handleHighlight(
  _window: Window | WindowExperimental,
  _document: Document,
  elementId: string,
  searchString: string,
  minSearchStringLength: number = 1,
) {
  try {
    // See https://developer.mozilla.org/en-US/docs/Web/API/HighlightRegistry/clear#browser_compatibility
    const browserApi = _window as unknown as WindowExperimental;

    // API is not supported in this browser.
    if (!browserApi.CSS.highlights) return;

    // Clear all highlighting if we don't have a search string.
    if (searchString.length < minSearchStringLength) {
      browserApi.CSS.highlights.clear();
      return;
    }

    // Apply highlighting to the docket nodes.
    const docketNode = _document.getElementById(elementId);
    if (!docketNode) return;

    const treeWalker = _document.createTreeWalker(docketNode, NodeFilter.SHOW_TEXT);
    const allTextNodes = [];
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
      allTextNodes.push(currentNode);
      currentNode = treeWalker.nextNode();
    }

    const ranges = allTextNodes.reduce((accumulator, el) => {
      const text = el.textContent?.toLowerCase() ?? '';

      const indices = [];
      let startPos = 0;
      while (startPos < text.length) {
        const index = text.indexOf(searchString, startPos);
        if (index === -1) break;
        indices.push(index);
        startPos = index + searchString.length;
      }

      const innerRanges = indices.map((index) => {
        const range = new Range();
        range.setStart(el, index);
        range.setEnd(el, index + searchString.length);
        return range;
      });
      if (innerRanges.length) accumulator.push(...innerRanges);
      return accumulator;
    }, [] as Range[]);

    // TypeScript does not ship experimental browser type definitions which are being used here.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const searchResultsHighlight = new Highlight(...ranges.flat());
    browserApi.CSS.highlights.set('search-results', searchResultsHighlight);
  } catch {
    // We want to silently fail and not crash the browser.
  }
}
