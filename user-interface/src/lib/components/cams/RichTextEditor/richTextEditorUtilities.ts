export const ZERO_WIDTH_SPACE = '\u200B';
export const ZERO_WIDTH_SPACE_REGEX = new RegExp(ZERO_WIDTH_SPACE, 'g');
type RichTextFormat = 'strong' | 'em' | 'u';

const EDITOR_CONTENT_SELECTOR = '.editor-content';

const normalizeContentEditableRoot = (root: HTMLElement) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.parentNode === root && node.textContent?.trim()) {
      const p = document.createElement('p');
      node.replaceWith(p);
      p.appendChild(node);
    }
  }
};

function normalizeInlineFormatting(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const inlineTags = ['strong', 'em'];
  const classBasedSpans = ['underline'];

  const shouldMerge = (a: Element, b: Element): boolean => {
    // Match by tag
    if (a.tagName === b.tagName && inlineTags.includes(a.tagName.toLowerCase())) {
      return true;
    }

    // Match span.class
    if (
      a.tagName === 'SPAN' &&
      b.tagName === 'SPAN' &&
      classBasedSpans.some((cls) => a.classList.contains(cls) && b.classList.contains(cls))
    ) {
      return true;
    }

    return false;
  };

  const normalizeElement = (node: Element) => {
    for (let i = node.childNodes.length - 1; i > 0; i--) {
      const current = node.childNodes[i];
      const prev = node.childNodes[i - 1];

      if (
        current.nodeType === Node.ELEMENT_NODE &&
        prev.nodeType === Node.ELEMENT_NODE &&
        shouldMerge(current as Element, prev as Element)
      ) {
        const currEl = current as Element;
        const prevEl = prev as Element;

        // Move current's children into prev
        while (currEl.firstChild) {
          prevEl.appendChild(currEl.firstChild);
        }

        // Remove current
        node.removeChild(currEl);
      }
    }

    // Remove empty inline elements
    Array.from(node.childNodes).forEach((child) => {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (inlineTags.includes((child as Element).tagName.toLowerCase()) ||
          ((child as Element).tagName === 'SPAN' &&
            classBasedSpans.some((cls) => (child as Element).classList.contains(cls)))) &&
        !child.textContent?.trim()
      ) {
        node.removeChild(child);
      }
    });

    node.normalize();
  };

  let current: Node | null = walker.currentNode;
  while (current) {
    normalizeElement(current as Element);
    current = walker.nextNode();
  }
}

const stripFormatting = (node: Node) => {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  const inlineTags = ['strong', 'b', 'em', 'i', 'u', 'span', 'font'];

  inlineTags.forEach((tag) => {
    node.querySelectorAll(tag).forEach((el) => {
      while (el.firstChild) {
        el.parentNode?.insertBefore(el.firstChild, el);
      }
      el.remove();
    });
  });
};

const isEditorInRange = (): boolean => {
  const editor = document.querySelector(EDITOR_CONTENT_SELECTOR);
  const selection = window.getSelection();

  if (!editor || !selection?.rangeCount) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return editor.contains(range.startContainer);
};

const findClosestAncestor = <T extends Element = Element>(
  node: Node | null,
  selector: string,
  stopAtSelector = EDITOR_CONTENT_SELECTOR,
): T | null => {
  while (node) {
    if (node instanceof Element) {
      if (node.matches(selector)) {
        return node as T;
      }
      if (node.matches(stopAtSelector)) {
        return null;
      }
    }
    node = node.parentNode;
  }
  return null;
};

const createRichTextElement = (format: RichTextFormat): HTMLElement => {
  switch (format) {
    case 'strong':
      return document.createElement('strong');
    case 'em':
      return document.createElement('em');
    case 'u': {
      const span = document.createElement('span');
      span.className = 'underline';
      return span;
    }
  }
};

const isMatchingElement = (el: Element, format: RichTextFormat): boolean => {
  switch (format) {
    case 'strong':
      return el.tagName === 'STRONG';
    case 'em':
      return el.tagName === 'EM';
    case 'u':
      return el.tagName === 'SPAN' && el.classList.contains('underline');
    default:
      return false;
  }
};

const toggleSelection = (tagName: RichTextFormat) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);

  if (range.collapsed) {
    // Collapsed selection — toggle inline formatting state
    // Optionally create an empty element with zero-width space
    const el = createRichTextElement(tagName);
    el.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));
    range.insertNode(el);

    // Move selection inside the new element
    const newRange = document.createRange();
    newRange.setStart(el.firstChild!, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    return;
  }

  // Extended selection — wrap or unwrap selection content
  const contents = range.cloneContents();

  // If content is already wrapped with this tag, unwrap it
  // If content wholly contains this tag, expand the tag
  // Here is |some <strong>sample text</strong>| that contains some markup.
  // --> Here is <strong>some sample text</strong> that contains some markup.
  // Here is some |<strong>sample text</strong>| that contains some markup.
  // --> Here is some sample text that contains some markup.
  // Here is some |<strong>sample text</strong> that |contains some markup.
  // --> Here is some <strong>sample text that </strong>contains some markup.
  // Here is |some <strong>sample| text</strong> that contains some markup.
  // --> Here is <strong>some sample text</strong> that contains some markup.
  // Here is some <strong>sample |text</strong> that contains| some markup.
  // --> Here is some <strong>sample text that contains</strong> some markup.

  // Check if the selection is exactly the content of a single tag of the target type
  // We need to check if the selection's parent is a tag of the target type and if the selection
  // encompasses the entire content of that tag
  let isExactlyOneTag = false;

  // Store the original range information before extracting contents
  const { startContainer, endContainer, startOffset, endOffset } = range;

  // Check if both start and end containers are the same text node or are children of the same parent
  if (startContainer === endContainer || startContainer.parentNode === endContainer.parentNode) {
    const parent = startContainer.parentNode as HTMLElement;

    // Check if the parent is an element of the target type
    if (parent && parent.nodeType === Node.ELEMENT_NODE && isMatchingElement(parent, tagName)) {
      // Check if the selection encompasses the entire content of the parent
      const parentContent = parent.textContent || '';
      const selectedContent = contents.textContent || '';

      // If the selected content is the same as the parent's content, then the selection
      // encompasses the entire content of the parent
      isExactlyOneTag =
        parentContent === selectedContent &&
        // Make sure we're not selecting more than just this element
        startOffset === 0 &&
        endOffset ===
          (endContainer.nodeType === Node.TEXT_NODE
            ? endContainer.textContent?.length || 0
            : endContainer.childNodes.length);

      if (isExactlyOneTag) {
        const grandParent = parent.parentNode;
        if (!grandParent) {
          return;
        }

        // Move all children out of the formatting element
        while (parent.firstChild) {
          grandParent.insertBefore(parent.firstChild, parent);
        }

        // Remove the formatting element
        grandParent.removeChild(parent);
        normalizeInlineFormatting(grandParent);

        return;
      }
    }
  }

  // Check if the selection contains any tags of the target type
  const containsTargetTag = Array.from(contents.querySelectorAll(tagName)).length > 0;

  // Check if we need to unwrap (when selection is exactly one tag) or wrap
  if (containsTargetTag) {
    // Case: Selection contains or partially overlaps with tags of the target type

    // First, collect all text nodes and elements that aren't of the target type
    const nodesToWrap: Node[] = [];
    const processNode = (node: Node) => {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as HTMLElement).tagName.toLowerCase() === tagName
      ) {
        // For target elements, add their children to be processed
        Array.from(node.childNodes).forEach((child) => processNode(child));
      } else {
        nodesToWrap.push(node);
      }
    };

    Array.from(contents.childNodes).forEach((node) => processNode(node));

    // Create a new wrapper and add all the collected nodes
    const wrapper = createRichTextElement(tagName);
    nodesToWrap.forEach((node) => wrapper.appendChild(node));

    // Clear the original contents and add the wrapper
    while (contents.firstChild) {
      contents.removeChild(contents.firstChild);
    }
    contents.appendChild(wrapper);

    range.deleteContents();
    range.insertNode(contents);
  } else {
    // Case: Selection doesn't contain any tags of the target type - wrap it
    const wrapper = createRichTextElement(tagName);
    wrapper.appendChild(contents);
    range.deleteContents();
    range.insertNode(wrapper);
  }

  // Restore selection
  // selection.removeAllRanges();
  // const newRange = document.createRange();
  // if (range.startContainer.firstChild) {
  //   newRange.setStartBefore(range.startContainer.firstChild);
  //   newRange.setEndAfter(range.startContainer.lastChild!);
  //   selection.addRange(newRange);
  // }

  // Normalize
  if (selection.anchorNode) {
    normalizeInlineFormatting(selection.anchorNode);
  }
  // TODO: remove all these comments and simplify
};

const indentListItem = () => {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const li = node instanceof Element ? node.closest?.('li') : node.parentElement?.closest('li');
  if (!li) {
    return;
  }

  const parentList = li.parentElement;
  if (!parentList) {
    return;
  }

  const prevLi = li.previousElementSibling;
  if (!prevLi || prevLi.tagName !== 'LI') {
    return;
  }

  let nestedList = prevLi.querySelector('ul, ol');
  if (!nestedList) {
    nestedList = document.createElement(parentList.tagName.toLowerCase());
    prevLi.appendChild(nestedList);
  }

  // Save cursor position relative to li
  const offsetNode = range.startContainer;
  const offset = range.startOffset;

  nestedList.appendChild(li);

  // Restore selection
  const newRange = document.createRange();
  newRange.setStart(offsetNode, Math.min(offset, offsetNode.textContent?.length ?? offset));
  newRange.collapse(true);

  selection.removeAllRanges();
  selection.addRange(newRange);
};

const outdentListItem = () => {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const targetLi =
    node instanceof Element ? node.closest?.('li') : node.parentElement?.closest('li');
  if (!targetLi) {
    return;
  }

  // get all following siblings of li (liSiblings)
  const allChildrenOfLiParent = Array.from(targetLi.parentElement?.children || []);
  const liNextSiblings = allChildrenOfLiParent.slice(allChildrenOfLiParent.indexOf(targetLi) + 1);

  const parentList = targetLi.parentElement;
  const grandparentLi = parentList?.parentElement;

  const editor = document.querySelector(EDITOR_CONTENT_SELECTOR);

  if (!parentList || !grandparentLi) {
    return;
  }
  if (!editor?.contains(grandparentLi) || editor === grandparentLi) {
    return;
  }

  // Save cursor position
  const offsetNode = range.startContainer;
  const offset = range.startOffset;

  grandparentLi.parentElement?.insertBefore(targetLi, grandparentLi.nextSibling);

  if (parentList.children.length === 0) {
    parentList.remove();
  }

  // move all liSiblings to be children of li in a new ul node.
  if (liNextSiblings.length > 0) {
    const newUl = document.createElement('ul');
    liNextSiblings.forEach((sibling) => {
      newUl.appendChild(sibling);
    });
    targetLi.appendChild(newUl);
  }

  // Restore selection
  const newRange = document.createRange();
  newRange.setStart(offsetNode, Math.min(offset, offsetNode.textContent?.length ?? offset));
  newRange.collapse(true);

  selection.removeAllRanges();
  selection.addRange(newRange);
};

const unwrapList = () => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const list = findClosestAncestor<HTMLUListElement | HTMLOListElement>(
    range.startContainer,
    'ul,ol',
  );
  if (!list) {
    return;
  }

  const editor = document.querySelector(EDITOR_CONTENT_SELECTOR);
  if (!editor?.contains(list)) {
    return;
  }

  const parent = list.parentNode!;
  const paragraphFragments: HTMLParagraphElement[] = [];

  list.querySelectorAll('li').forEach((li) => {
    const p = document.createElement('p');
    stripFormatting(p);
    const span = document.createElement('span');

    span.innerHTML = li.innerHTML || ZERO_WIDTH_SPACE;
    p.appendChild(span);
    paragraphFragments.push(p);
  });

  paragraphFragments.forEach((p) => parent.insertBefore(p, list));
  list.remove();

  // Move selection to the first paragraph's start
  const firstSpan = paragraphFragments[0].querySelector('span');
  if (firstSpan?.firstChild && firstSpan.firstChild.nodeType === Node.TEXT_NODE) {
    const textNode = firstSpan.firstChild as Text;
    const newRange = document.createRange();
    newRange.setStart(textNode, textNode.length);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
};

const createListWithEmptyItem = (type: 'ul' | 'ol'): HTMLElement => {
  const list = document.createElement(type);
  const li = document.createElement('li');
  li.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));
  list.appendChild(li);
  return list;
};

const insertList = (type: 'ul' | 'ol') => {
  if (!isEditorInRange()) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const editor = document.querySelector(EDITOR_CONTENT_SELECTOR);
  if (!editor?.contains(range.startContainer)) {
    return;
  }

  const currentParagraph = findClosestAncestor<HTMLParagraphElement>(range.startContainer, 'p');
  const currentParagraphContent = currentParagraph?.textContent?.trim();
  const isParagraphEmpty =
    currentParagraph &&
    cleanZeroWidthSpaces(currentParagraphContent || '') === '' &&
    currentParagraph.parentNode === editor;

  const list = createListWithEmptyItem(type);
  const listItem = list.querySelector('li');

  const parent = currentParagraph?.parentNode || editor;

  // Handle selection or trailing content
  let extractedContent: DocumentFragment | null = null;

  if (!range.collapsed) {
    // Text is selected — extract and insert into the list item
    extractedContent = range.extractContents();
  } else if (currentParagraph) {
    // No selection, but check for content after the cursor
    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEndAfter(currentParagraph.lastChild!);
    if (!afterRange.collapsed) {
      extractedContent = afterRange.extractContents();
    }
  }

  // Insert extracted content into list item span
  if (listItem && extractedContent && extractedContent.hasChildNodes()) {
    listItem.innerHTML = ''; // clear default content
    listItem.appendChild(extractedContent);
  }

  if (currentParagraph && parent) {
    if (isParagraphEmpty) {
      currentParagraph.replaceWith(list);
    } else {
      parent.insertBefore(list, currentParagraph.nextSibling);
    }

    if (!currentParagraph.textContent?.trim()) {
      currentParagraph.remove();
    }
  } else {
    range.deleteContents();
    range.insertNode(list);
  }

  // Move the selection inside the list item's span
  if (listItem?.firstChild) {
    const newRange = document.createRange();
    newRange.setStart(listItem.firstChild, listItem.firstChild.nodeType === Node.TEXT_NODE ? 1 : 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
};

const toggleList = (type: 'ul' | 'ol') => {
  if (!isEditorInRange()) {
    return;
  }

  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const li = findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');
  const list = findClosestAncestor<HTMLOListElement | HTMLUListElement>(
    range.startContainer,
    'ol,ul',
  );

  if (li && list?.tagName.toLowerCase() === type) {
    unwrapList();
  } else {
    insertList(type);
  }
};

const cleanZeroWidthSpaces = (html: string): string => {
  return html.replace(ZERO_WIDTH_SPACE_REGEX, '');
};

const handleCtrlKey = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
  if (e.ctrlKey) {
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        toggleSelection('strong');
        return true;
      case 'i':
        e.preventDefault();
        toggleSelection('em');
        return true;
      case 'u':
        e.preventDefault();
        toggleSelection('u');
        return true;
    }
  }
  return false;
};

const handleDentures = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
  if (e.key === 'Tab') {
    const selection = window.getSelection();
    if (!selection?.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const listItem = findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');

    if (!listItem) {
      // Not in a list item — allow native tab behavior
      return false;
    }

    e.preventDefault();
    if (e.shiftKey) {
      outdentListItem();
    } else {
      indentListItem();
    }
    return true;
  }
  return false;
};

const handleEnterKey = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return false;
  }
  if (e.key === 'Enter') {
    const range = selection.getRangeAt(0);
    const listItem = findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');

    if (listItem) {
      const isEmpty = listItem.textContent?.trim() === '';
      if (isEmpty) {
        e.preventDefault();

        // Exit list: insert a paragraph after the list
        const p = document.createElement('p');
        stripFormatting(p);
        p.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));

        const list = findClosestAncestor<HTMLOListElement | HTMLUListElement>(listItem, 'ol,ul');
        list?.parentNode?.insertBefore(p, list.nextSibling);

        listItem.remove();

        // Move selection to new paragraph
        const newRange = document.createRange();
        newRange.setStart(p.firstChild!, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        // Optionally remove the list if it’s now empty
        if (list && [...list.children].every((child) => child.textContent?.trim() === '')) {
          list.remove();
        }

        return true;
      }

      // Allow native list behavior otherwise
      return false;
    }

    // Not in list — insert a new paragraph
    e.preventDefault();

    const currentParagraph = findClosestAncestor<HTMLParagraphElement>(range.startContainer, 'p');

    const newParagraph = document.createElement('p');
    stripFormatting(newParagraph);
    newParagraph.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));

    if (currentParagraph && currentParagraph.parentNode) {
      // Insert after existing paragraph
      currentParagraph.parentNode.insertBefore(newParagraph, currentParagraph.nextSibling);
    } else {
      // Couldn’t find a paragraph — insert at selection
      range.collapse(false);
      range.insertNode(newParagraph);
    }

    const newRange = document.createRange();
    newRange.setStart(newParagraph.firstChild!, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    return true;
  }

  return false;
};

const handlePrintableKey = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
  const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (!isPrintableKey) {
    return false;
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return false;
  }

  // if it's not enter, tab, or ctrl
  const range = selection.getRangeAt(0);
  const editor = document.querySelector(EDITOR_CONTENT_SELECTOR);

  if (editor?.contains(range.startContainer)) {
    const container =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;

    const isInRootWithoutBlock =
      container &&
      editor?.contains(container) &&
      !findClosestAncestor(container, 'p,li,ul,ol') &&
      findClosestAncestor(container, EDITOR_CONTENT_SELECTOR) === editor;

    if (isInRootWithoutBlock) {
      e.preventDefault();

      const p = document.createElement('p');
      stripFormatting(p);
      const char = e.key.length === 1 ? e.key : ''; // Skip non-printable keys
      p.textContent = char || ZERO_WIDTH_SPACE;

      range.insertNode(p);

      const newRange = document.createRange();
      const textNode = p.firstChild;
      const offset = textNode instanceof Text ? textNode.length : 1;

      newRange.setStart(textNode!, offset);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      return true;
    }
  }
  return false;
};

export {
  createRichTextElement,
  isMatchingElement,
  findClosestAncestor,
  handleCtrlKey,
  handleEnterKey,
  handlePrintableKey,
  handleDentures,
  indentListItem,
  outdentListItem,
  insertList,
  toggleList,
  unwrapList,
  createListWithEmptyItem, // Optional
  normalizeContentEditableRoot,
  stripFormatting,
  toggleSelection,
  cleanZeroWidthSpaces,
};
