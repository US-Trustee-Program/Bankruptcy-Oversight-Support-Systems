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

const createElement = (format: RichTextFormat): HTMLElement => {
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
    const el = document.createElement(tagName);
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
  const contents = range.extractContents();

  let modified = false;

  // If content is already wrapped with this tag, unwrap it
  contents.childNodes.forEach((node) => {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).tagName.toLowerCase() === tagName
    ) {
      const inner = Array.from(node.childNodes);
      inner.forEach((child) => contents.appendChild(child));
      contents.removeChild(node);
      modified = true;
    }
  });

  if (!modified) {
    // Wrap in tagName
    const wrapper = document.createElement(tagName);
    wrapper.appendChild(contents);
    range.insertNode(wrapper);
  } else {
    // Insert modified unwrapped content
    range.insertNode(contents);
  }

  // Restore selection
  selection.removeAllRanges();
  const newRange = document.createRange();
  if (range.startContainer.firstChild) {
    newRange.setStartBefore(range.startContainer.firstChild);
    newRange.setEndAfter(range.startContainer.lastChild!);
    selection.addRange(newRange);
  }
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
  const li = node instanceof Element ? node.closest?.('li') : node.parentElement?.closest('li');
  if (!li) {
    return;
  }

  // get all following siblings of li (liSiblings)
  const allChildrenOfLiParent = Array.from(li.parentElement?.children || []);
  const liSiblings = allChildrenOfLiParent.slice(allChildrenOfLiParent.indexOf(li) + 1);

  const parentList = li.parentElement;
  const grandparentLi = parentList?.parentElement;

  if (!parentList || !grandparentLi) {
    return;
  }

  // Save cursor position
  const offsetNode = range.startContainer;
  const offset = range.startOffset;

  grandparentLi.parentElement?.insertBefore(li, grandparentLi.nextSibling);

  if (parentList.children.length === 0) {
    parentList.remove();
  }

  // move all liSiblings to be children of li in a new ul node.
  const newUl = document.createElement('ul');
  liSiblings.forEach((sibling) => {
    newUl.appendChild(sibling);
  });
  li.appendChild(newUl);

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
  const span = document.createElement('span');
  span.textContent = ZERO_WIDTH_SPACE;
  li.appendChild(span);
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
  const span = list.querySelector('span');

  const parent = currentParagraph?.parentNode || editor;

  if (currentParagraph && parent) {
    // break out of paragraph and insert list as sibling
    if (isParagraphEmpty) {
      currentParagraph.replaceWith(list);
    } else if (currentParagraph) {
      parent.insertBefore(list, currentParagraph.nextSibling);
    } else {
      editor.appendChild(list);
    }

    // remove any empty paragraph
    if (!currentParagraph.textContent?.trim()) {
      currentParagraph.remove();
    }
  } else {
    // no paragraph found - insert where the selection is
    range.deleteContents();
    range.insertNode(list);
  }

  // move the selection into the span
  if (span?.firstChild) {
    const newRange = document.createRange();
    newRange.setStart(span.firstChild, 1);
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
        const span = document.createElement('span');
        span.textContent = ZERO_WIDTH_SPACE;
        p.appendChild(span);

        const list = findClosestAncestor<HTMLOListElement | HTMLUListElement>(listItem, 'ol,ul');
        list?.parentNode?.insertBefore(p, list.nextSibling);

        listItem.remove();

        // Move selection to new paragraph
        const newRange = document.createRange();
        newRange.setStart(span.firstChild!, 1);
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
    const newSpan = document.createElement('span');
    newSpan.textContent = ZERO_WIDTH_SPACE;
    newParagraph.appendChild(newSpan);

    if (currentParagraph && currentParagraph.parentNode) {
      // Insert after existing paragraph
      currentParagraph.parentNode.insertBefore(newParagraph, currentParagraph.nextSibling);
    } else {
      // Couldn’t find a paragraph — insert at selection
      range.collapse(false);
      range.insertNode(newParagraph);
    }

    const newRange = document.createRange();
    newRange.setStart(newSpan.firstChild!, 1);
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
      const span = document.createElement('span');

      const char = e.key.length === 1 ? e.key : ''; // Skip non-printable keys
      span.textContent = char || ZERO_WIDTH_SPACE;
      p.appendChild(span);

      range.insertNode(p);

      const newRange = document.createRange();
      const textNode = span.firstChild;
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
  createElement,
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
