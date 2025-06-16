import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { Editor } from './Editor';

describe('Editor: Private Methods', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe('findClosestAncestor', () => {
    test('finds the closest ancestor matching a selector', () => {
      // Setup a nested structure
      container.innerHTML = `
        <div class="outer">
          <p class="paragraph">
            <span class="inner">Text</span>
          </p>
        </div>
      `;

      const span = container.querySelector('.inner')!;
      const findClosestAncestor = (editor as any).findClosestAncestor.bind(editor);

      // Test finding the paragraph
      const paragraph = findClosestAncestor(span, 'p');
      expect(paragraph).toBeTruthy();
      expect(paragraph.classList.contains('paragraph')).toBe(true);

      // Test finding the outer div
      const outer = findClosestAncestor(span, '.outer');
      expect(outer).toBeTruthy();
      expect(outer.classList.contains('outer')).toBe(true);
    });

    test('returns null when no matching ancestor is found', () => {
      container.innerHTML = `
        <div class="outer">
          <p class="paragraph">
            <span class="inner">Text</span>
          </p>
        </div>
      `;

      const span = container.querySelector('.inner')!;
      const findClosestAncestor = (editor as any).findClosestAncestor.bind(editor);

      // Test finding a non-existent ancestor
      const nonExistent = findClosestAncestor(span, '.non-existent');
      expect(nonExistent).toBeNull();
    });

    test('returns null when node is null', () => {
      const findClosestAncestor = (editor as any).findClosestAncestor.bind(editor);

      // Test with null node
      const result = findClosestAncestor(null, 'p');
      expect(result).toBeNull();
    });

    test('returns null when reaching the root element', () => {
      container.innerHTML = `
        <div class="outer">
          <p class="paragraph">
            <span class="inner">Text</span>
          </p>
        </div>
      `;

      const span = container.querySelector('.inner')!;
      const findClosestAncestor = (editor as any).findClosestAncestor.bind(editor);

      // Test finding an ancestor that would be outside the root
      // The root is the container div, so we shouldn't find anything outside it
      const outsideRoot = findClosestAncestor(span, 'body');
      expect(outsideRoot).toBeNull();
    });
  });

  describe('isRangeAcrossBlocks', () => {
    test('returns true when range spans multiple block elements', () => {
      container.innerHTML = `
        <p id="p1">First paragraph</p>
        <p id="p2">Second paragraph</p>
      `;

      const p1 = container.querySelector('#p1')!;
      const p2 = container.querySelector('#p2')!;

      const range = document.createRange();
      range.setStart(p1.firstChild!, 0);
      range.setEnd(p2.firstChild!, 5);

      const isRangeAcrossBlocks = (editor as any).isRangeAcrossBlocks.bind(editor);
      expect(isRangeAcrossBlocks(range)).toBe(true);
    });

    test('returns false when range is within a single block element', () => {
      container.innerHTML = `
        <p id="p1">First paragraph</p>
      `;

      const p1 = container.querySelector('#p1')!;

      const range = document.createRange();
      range.setStart(p1.firstChild!, 0);
      range.setEnd(p1.firstChild!, 5);

      const isRangeAcrossBlocks = (editor as any).isRangeAcrossBlocks.bind(editor);
      expect(isRangeAcrossBlocks(range)).toBe(false);
    });

    test('returns false when range spans inline elements within the same block', () => {
      container.innerHTML = `
        <p id="p1">First <strong>paragraph</strong> with formatting</p>
      `;

      const p1 = container.querySelector('#p1')!;
      const strong = p1.querySelector('strong')!;

      const range = document.createRange();
      range.setStart(p1.firstChild!, 0);
      range.setEnd(strong.firstChild!, 5);

      const isRangeAcrossBlocks = (editor as any).isRangeAcrossBlocks.bind(editor);
      expect(isRangeAcrossBlocks(range)).toBe(false);
    });
  });

  describe('getAncestorIfLastLeaf', () => {
    test('returns the parent list when the list item is the last child', () => {
      container.innerHTML = `
        <ul id="parentList">
          <li>Item 1</li>
          <li id="lastItem">Item 2</li>
        </ul>
      `;

      const parentList = container.querySelector('#parentList')! as HTMLUListElement;

      const getAncestorIfLastLeaf = (editor as any).getAncestorIfLastLeaf.bind(editor);
      const result = getAncestorIfLastLeaf(parentList);

      expect(result).toBe(parentList);
    });

    test('returns false when the list item is not the last child', () => {
      container.innerHTML = `
        <ul id="grandparentList">
          <li>Item 1</li>
          <li id="parentLi">
            <ul id="parentList">
              <li>Nested Item 1</li>
            </ul>
          </li>
          <li>Item 3</li>
        </ul>
      `;

      const parentList = container.querySelector('#parentList')! as HTMLUListElement;

      const getAncestorIfLastLeaf = (editor as any).getAncestorIfLastLeaf.bind(editor);
      const result = getAncestorIfLastLeaf(parentList);

      expect(result).toBe(false);
    });

    test('returns the parent list when there is no grandparent list item', () => {
      // Setup a list without a grandparent list item
      container.innerHTML = `
        <ul id="parentList">
          <li>Item 1</li>
          <li id="lastItem">Item 2</li>
        </ul>
      `;

      const parentList = container.querySelector('#parentList')! as HTMLUListElement;

      const getAncestorIfLastLeaf = (editor as any).getAncestorIfLastLeaf.bind(editor);
      const result = getAncestorIfLastLeaf(parentList);

      // Should return the parent list since there is no grandparent list item
      expect(result).toBe(parentList);
    });
  });

  describe('indentListItem', () => {
    test('indents a list item under the previous sibling', () => {
      container.innerHTML = `
        <ul>
          <li id="firstItem">First item</li>
          <li id="secondItem">Second item</li>
        </ul>
      `;

      const secondLi = container.querySelector('#secondItem')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(secondLi.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const indentListItem = (editor as any).indentListItem.bind(editor);
      indentListItem();

      // Check that the second item is now nested under the first
      const firstLi = container.querySelector('#firstItem')!;
      const nestedUl = firstLi.querySelector('ul');
      expect(nestedUl).toBeTruthy();
      expect(nestedUl?.children.length).toBe(1);
      expect(nestedUl?.firstElementChild?.textContent).toBe('Second item');
    });

    test('adds to existing nested list when indenting', () => {
      container.innerHTML = `
        <ul>
          <li id="firstItem">First item
            <ul>
              <li>Existing nested item</li>
            </ul>
          </li>
          <li id="secondItem">Second item</li>
        </ul>
      `;

      const secondLi = container.querySelector('#secondItem')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(secondLi.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const indentListItem = (editor as any).indentListItem.bind(editor);
      indentListItem();

      // Check that the second item is now added to the existing nested list
      const firstLi = container.querySelector('#firstItem')!;
      const nestedUl = firstLi.querySelector('ul');
      expect(nestedUl).toBeTruthy();
      expect(nestedUl?.children.length).toBe(2);
      expect(nestedUl?.children[1].textContent).toBe('Second item');
    });

    test('does nothing when there is no previous sibling', () => {
      container.innerHTML = `
        <ul>
          <li id="firstItem">First item</li>
        </ul>
      `;

      const firstLi = container.querySelector('#firstItem')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(firstLi.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const indentListItem = (editor as any).indentListItem.bind(editor);
      indentListItem();

      // Check that the structure remains unchanged
      expect(container.innerHTML.includes('<li id="firstItem">First item</li>')).toBe(true);
      expect(container.querySelectorAll('ul').length).toBe(1);
      expect(container.querySelectorAll('li').length).toBe(1);
    });

    test('preserves cursor position after indentation', () => {
      container.innerHTML = `
        <ul>
          <li id="firstItem">First item</li>
          <li id="secondItem">Second item</li>
        </ul>
      `;

      const secondLi = container.querySelector('#secondItem')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(secondLi.firstChild!, 6); // After "Second"
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const indentListItem = (editor as any).indentListItem.bind(editor);
      indentListItem();

      // Check that the cursor position is preserved
      const newRange = selection.getRangeAt(0);
      expect(newRange.startOffset).toBe(6);
      expect(newRange.collapsed).toBe(true);
    });
  });

  describe('isEntireSelectionFormatted', () => {
    test('returns true when selection is entirely within a formatted element', () => {
      container.innerHTML = `
        <p>Text with <strong id="strong">bold text</strong> in it</p>
      `;

      const strongEl = container.querySelector('#strong')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(strongEl.firstChild!, 0);
      range.setEnd(strongEl.firstChild!, 4); // Select "bold"
      selection.removeAllRanges();
      selection.addRange(range);

      const isEntireSelectionFormatted = (editor as any).isEntireSelectionFormatted.bind(editor);
      const result = isEntireSelectionFormatted(range, 'strong');

      expect(result).toBe(true);
    });

    test('returns false when selection starts outside a formatted element', () => {
      container.innerHTML = `
        <p id="p">Text with <strong id="strong">bold text</strong> in it</p>
      `;

      const p = container.querySelector('#p')!;
      const strongEl = container.querySelector('#strong')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(p.firstChild!, 5); // Start in "Text with"
      range.setEnd(strongEl.firstChild!, 4); // End in "bold text"
      selection.removeAllRanges();
      selection.addRange(range);

      const isEntireSelectionFormatted = (editor as any).isEntireSelectionFormatted.bind(editor);
      const result = isEntireSelectionFormatted(range, 'strong');

      expect(result).toBe(false);
    });

    test('returns false when selection ends outside a formatted element', () => {
      container.innerHTML = `
        <p id="p">Text with <strong id="strong">bold text</strong> in it</p>
      `;

      const p = container.querySelector('#p')!;
      const strongEl = container.querySelector('#strong')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(strongEl.firstChild!, 0); // Start in "bold text"
      range.setEnd(p.lastChild!, 5); // End in " in it"
      selection.removeAllRanges();
      selection.addRange(range);

      const isEntireSelectionFormatted = (editor as any).isEntireSelectionFormatted.bind(editor);
      const result = isEntireSelectionFormatted(range, 'strong');

      expect(result).toBe(false);
    });

    test('returns false when selection spans multiple formatted elements', () => {
      container.innerHTML = `
        <p id="p"><strong id="strong1">first</strong> text <strong id="strong2">second</strong></p>
      `;

      const strong1 = container.querySelector('#strong1')!;
      const strong2 = container.querySelector('#strong2')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(strong1.firstChild!, 0);
      range.setEnd(strong2.firstChild!, 6);
      selection.removeAllRanges();
      selection.addRange(range);

      const isEntireSelectionFormatted = (editor as any).isEntireSelectionFormatted.bind(editor);
      const result = isEntireSelectionFormatted(range, 'strong');

      expect(result).toBe(false);
    });

    test('returns true for underline formatting with span.underline', () => {
      container.innerHTML = `
        <p>Text with <span class="underline" id="underline">underlined text</span> in it</p>
      `;

      const underlineEl = container.querySelector('#underline')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(underlineEl.firstChild!, 0);
      range.setEnd(underlineEl.firstChild!, 10); // Select "underlined"
      selection.removeAllRanges();
      selection.addRange(range);

      const isEntireSelectionFormatted = (editor as any).isEntireSelectionFormatted.bind(editor);
      const result = isEntireSelectionFormatted(range, 'u');

      expect(result).toBe(true);
    });
  });

  describe('outdentListItem', () => {
    test('outdents a nested list item to the parent level', () => {
      container.innerHTML = `
        <ul id="parentList">
          <li id="parentItem">Parent item
            <ul>
              <li id="nestedItem">Nested item</li>
            </ul>
          </li>
        </ul>
      `;

      const nestedLi = container.querySelector('#nestedItem')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(nestedLi.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const outdentListItem = (editor as any).outdentListItem.bind(editor);
      outdentListItem();

      // Check that the nested item is now at the same level as the parent item
      const parentList = container.querySelector('#parentList')!;
      expect(parentList.children.length).toBe(2);
      expect(parentList.children[1].textContent).toBe('Nested item');
    });

    test('preserves subsequent siblings when outdenting', () => {
      container.innerHTML = `
        <ul id="parentList">
          <li id="parentItem">Parent item
            <ul>
              <li id="nestedItem1">Nested item 1</li>
              <li id="nestedItem2">Nested item 2</li>
              <li id="nestedItem3">Nested item 3</li>
            </ul>
          </li>
        </ul>
      `;

      const nestedLi1 = container.querySelector('#nestedItem1')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(nestedLi1.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const outdentListItem = (editor as any).outdentListItem.bind(editor);
      outdentListItem();

      // Check that the nested item 1 is now at the same level as the parent item
      const parentList = container.querySelector('#parentList')!;
      expect(parentList.children.length).toBe(2);
      expect(parentList.children[1].textContent).toContain('Nested item 1');

      // Check that nested items 2 and 3 are now nested under nested item 1
      const nestedList = parentList.children[1].querySelector('ul');
      expect(nestedList).toBeTruthy();
      expect(nestedList?.children.length).toBe(2);
      expect(nestedList?.children[0].textContent).toBe('Nested item 2');
      expect(nestedList?.children[1].textContent).toBe('Nested item 3');
    });

    test('does nothing when already at root level', () => {
      container.innerHTML = `
        <ul id="rootList">
          <li id="rootItem">Root item</li>
        </ul>
      `;

      const rootLi = container.querySelector('#rootItem')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(rootLi.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const outdentListItem = (editor as any).outdentListItem.bind(editor);
      outdentListItem();

      // Check that the structure remains unchanged
      expect(container.innerHTML.includes('<li id="rootItem">Root item</li>')).toBe(true);
      expect(container.querySelectorAll('ul').length).toBe(1);
      expect(container.querySelectorAll('li').length).toBe(1);
    });

    test('preserves cursor position after outdentation', () => {
      container.innerHTML = `
        <ul id="parentList">
          <li id="parentItem">Parent item
            <ul>
              <li id="nestedItem">Nested item</li>
            </ul>
          </li>
        </ul>
      `;

      const nestedLi = container.querySelector('#nestedItem')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(nestedLi.firstChild!, 6); // After "Nested"
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const outdentListItem = (editor as any).outdentListItem.bind(editor);
      outdentListItem();

      // Check that the cursor position is preserved
      const newRange = selection.getRangeAt(0);
      expect(newRange.startOffset).toBe(6);
      expect(newRange.collapsed).toBe(true);
    });
  });

  describe('removeFormattingFromRange', () => {
    test('removes formatting from a range within a formatted element', () => {
      container.innerHTML = `
        <p>Text with <strong id="strong">bold text</strong> in it</p>
      `;

      const strongEl = container.querySelector('#strong')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(strongEl.firstChild!, 0);
      range.setEnd(strongEl.firstChild!, 4); // Select "bold"
      selection.removeAllRanges();
      selection.addRange(range);

      const removeFormattingFromRange = (editor as any).removeFormattingFromRange.bind(editor);
      removeFormattingFromRange(range, 'strong');

      // The text "bold" should be extracted from the strong element
      expect(container.querySelector('p')?.textContent).toBe('Text with bold text in it');

      // The implementation might handle this in different ways:
      // 1. The strong element might be removed entirely
      // 2. The strong element might remain with the remaining text
      // 3. The strong element might remain but be empty
      // We'll just verify that the text "bold" is no longer in a strong element
      const boldIsInStrong = Array.from(container.querySelectorAll('strong')).some(el => 
        el.textContent?.includes('bold')
      );
      expect(boldIsInStrong).toBe(false);
    });

    test('removes formatting when start and end are in different elements', () => {
      container.innerHTML = `
        <p>Text <strong id="strong">with bold</strong> formatting</p>
      `;

      const p = container.querySelector('p')!;
      const strongEl = container.querySelector('#strong')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(strongEl.firstChild!, 5); // Start at "bold"
      range.setEnd(p.lastChild!, 5); // End at "formatting"
      selection.removeAllRanges();
      selection.addRange(range);

      const removeFormattingFromRange = (editor as any).removeFormattingFromRange.bind(editor);
      removeFormattingFromRange(range, 'strong');

      // The text should be extracted and reinserted without formatting
      expect(container.querySelector('p')?.textContent).toBe('Text with bold formatting');
      expect(container.querySelector('strong')?.textContent).toBe('with ');
    });

    test('handles underline formatting (span with class)', () => {
      container.innerHTML = `
        <p>Text with <span class="underline" id="underline">underlined text</span> in it</p>
      `;

      const underlineEl = container.querySelector('#underline')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(underlineEl.firstChild!, 0);
      range.setEnd(underlineEl.firstChild!, 10); // Select "underlined"
      selection.removeAllRanges();
      selection.addRange(range);

      const removeFormattingFromRange = (editor as any).removeFormattingFromRange.bind(editor);
      removeFormattingFromRange(range, 'u');

      // The text "underlined" should be extracted from the span
      expect(container.querySelector('p')?.textContent).toBe('Text with underlined text in it');

      // The implementation might handle this in different ways:
      // 1. The span element might be removed entirely
      // 2. The span element might remain with the remaining text
      // 3. The span element might remain but be empty
      // We'll just verify that the text "underlined" is no longer in a span with underline class
      const underlinedIsInSpan = Array.from(container.querySelectorAll('span.underline')).some(el => 
        el.textContent?.includes('underlined')
      );
      expect(underlinedIsInSpan).toBe(false);
    });
  });

  describe('removeFormatFromFragment', () => {
    test('removes all instances of a format from a document fragment', () => {
      container.innerHTML = `
        <div id="source">
          <strong>Bold text</strong> and <strong>more bold</strong>
        </div>
      `;

      const source = container.querySelector('#source')!;
      const fragment = document.createDocumentFragment();
      while (source.firstChild) {
        fragment.appendChild(source.firstChild);
      }

      const removeFormatFromFragment = (editor as any).removeFormatFromFragment.bind(editor);
      removeFormatFromFragment(fragment, 'strong');

      // Create a new container to check the fragment content
      const resultContainer = document.createElement('div');
      resultContainer.appendChild(fragment);

      // All strong elements should be removed, but their content preserved
      expect(resultContainer.querySelectorAll('strong').length).toBe(0);
      expect(resultContainer.textContent?.trim()).toBe('Bold text and more bold');
    });

    test('handles nested formatting elements', () => {
      container.innerHTML = `
        <div id="source">
          <strong>Bold <em>and italic</em> text</strong>
        </div>
      `;

      const source = container.querySelector('#source')!;
      const fragment = document.createDocumentFragment();
      while (source.firstChild) {
        fragment.appendChild(source.firstChild);
      }

      const removeFormatFromFragment = (editor as any).removeFormatFromFragment.bind(editor);
      removeFormatFromFragment(fragment, 'strong');

      // Create a new container to check the fragment content
      const resultContainer = document.createElement('div');
      resultContainer.appendChild(fragment);

      // Strong elements should be removed, but em should remain
      expect(resultContainer.querySelectorAll('strong').length).toBe(0);
      expect(resultContainer.querySelectorAll('em').length).toBe(1);
      expect(resultContainer.textContent?.trim()).toBe('Bold and italic text');
    });
  });

  describe('normalizeInlineFormatting', () => {
    test('merges adjacent identical formatting elements', () => {
      container.innerHTML = `
        <p>
          <strong>Bold</strong><strong>text</strong>
        </p>
      `;

      const normalizeInlineFormatting = (editor as any).normalizeInlineFormatting.bind(editor);
      normalizeInlineFormatting();

      // The two strong elements should be merged into one
      const strongElements = container.querySelectorAll('strong');
      expect(strongElements.length).toBe(1);
      expect(strongElements[0].textContent).toBe('Boldtext');
    });

    test('flattens nested identical formatting elements', () => {
      container.innerHTML = `
        <p>
          <strong>Bold <strong>nested</strong> text</strong>
        </p>
      `;

      const normalizeInlineFormatting = (editor as any).normalizeInlineFormatting.bind(editor);
      normalizeInlineFormatting();

      // The nested strong element should be flattened
      const strongElements = container.querySelectorAll('strong');
      expect(strongElements.length).toBe(1);
      expect(strongElements[0].textContent).toBe('Bold nested text');
    });

    test('removes empty formatting elements', () => {
      container.innerHTML = `
        <p>
          Text <strong></strong> with <em></em> empty elements
        </p>
      `;

      const normalizeInlineFormatting = (editor as any).normalizeInlineFormatting.bind(editor);
      normalizeInlineFormatting();

      // Empty formatting elements should be removed
      expect(container.querySelectorAll('strong').length).toBe(0);
      expect(container.querySelectorAll('em').length).toBe(0);
      expect(container.querySelector('p')?.textContent?.trim()).toBe('Text  with  empty elements');
    });

    test('merges span elements with the same class', () => {
      container.innerHTML = `
        <p>
          <span class="underline">Underlined</span><span class="underline">text</span>
        </p>
      `;

      const normalizeInlineFormatting = (editor as any).normalizeInlineFormatting.bind(editor);
      normalizeInlineFormatting();

      // The two span elements should be merged into one
      const spanElements = container.querySelectorAll('span.underline');
      expect(spanElements.length).toBe(1);
      expect(spanElements[0].textContent).toBe('Underlinedtext');
    });
  });

  describe('removeEmptyFormattingElements', () => {
    test('removes empty inline formatting elements', () => {
      container.innerHTML = `
        <p id="parent">
          Text <strong></strong> with <em></em> empty elements
        </p>
      `;

      const parent = container.querySelector('#parent')!;
      const removeEmptyFormattingElements = (editor as any).removeEmptyFormattingElements.bind(editor);
      removeEmptyFormattingElements(parent);

      // Empty formatting elements should be removed
      expect(parent.querySelectorAll('strong').length).toBe(0);
      expect(parent.querySelectorAll('em').length).toBe(0);
      expect(parent.textContent?.trim()).toBe('Text  with  empty elements');
    });

    test('removes empty span elements with formatting classes', () => {
      container.innerHTML = `
        <p id="parent">
          Text <span class="underline"></span> with empty spans
        </p>
      `;

      const parent = container.querySelector('#parent')!;
      const removeEmptyFormattingElements = (editor as any).removeEmptyFormattingElements.bind(editor);
      removeEmptyFormattingElements(parent);

      // Empty span elements with formatting classes should be removed
      expect(parent.querySelectorAll('span.underline').length).toBe(0);
      expect(parent.textContent?.trim()).toBe('Text  with empty spans');
    });

    test('keeps non-empty formatting elements', () => {
      container.innerHTML = `
        <p id="parent">
          <strong>Bold</strong> and <em>italic</em> text
        </p>
      `;

      const parent = container.querySelector('#parent')!;
      const removeEmptyFormattingElements = (editor as any).removeEmptyFormattingElements.bind(editor);
      removeEmptyFormattingElements(parent);

      // Non-empty formatting elements should be kept
      expect(parent.querySelectorAll('strong').length).toBe(1);
      expect(parent.querySelectorAll('em').length).toBe(1);
      expect(parent.textContent?.trim()).toBe('Bold and italic text');
    });
  });

  describe('exitFormattingElement', () => {
    test('exits a formatting element and positions cursor in a new structure', () => {
      container.innerHTML = `
        <p><strong id="strong">Bold text</strong></p>
      `;

      const strongEl = container.querySelector('#strong')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(strongEl.firstChild!, 4); // After "Bold"
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const exitFormattingElement = (editor as any).exitFormattingElement.bind(editor);
      exitFormattingElement(strongEl, range);

      // Should create a new structure after the strong element
      const p = container.querySelector('p')!;
      expect(p.childNodes.length).toBe(2);
      expect(p.childNodes[0].textContent).toBe('Bold text');

      // The cursor should be positioned in the new structure
      const newRange = selection.getRangeAt(0);
      expect(newRange.startContainer.textContent).toBe('\u200B'); // Zero-width space
      expect(newRange.startOffset).toBe(1);
    });

    test('preserves other active formats when exiting a formatting element', () => {
      container.innerHTML = `
        <p><strong id="strong"><em>Bold and italic</em></strong></p>
      `;

      const strongEl = container.querySelector('#strong')!;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(strongEl.querySelector('em')!.firstChild!, 4); // After "Bold"
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const exitFormattingElement = (editor as any).exitFormattingElement.bind(editor);
      exitFormattingElement(strongEl, range);

      // Should create a new em element after the strong element
      const p = container.querySelector('p')!;
      expect(p.childNodes.length).toBe(2);
      expect(p.childNodes[0].textContent).toBe('Bold and italic');
      expect(p.childNodes[1].tagName.toLowerCase()).toBe('em');

      // The cursor should be positioned in the new em element
      const newRange = selection.getRangeAt(0);
      expect(newRange.startContainer.textContent).toBe('\u200B'); // Zero-width space
      expect(newRange.startOffset).toBe(1);
    });
  });

  describe('getActiveFormatsExcluding', () => {
    test('returns all active formats excluding the specified element', () => {
      container.innerHTML = `
        <p><strong id="strong"><em id="em"><span class="underline" id="underline">Formatted text</span></em></strong></p>
      `;

      const strongEl = container.querySelector('#strong')!;
      const emEl = container.querySelector('#em')!;
      const underlineEl = container.querySelector('#underline')!;
      const textNode = underlineEl.firstChild!;

      const getActiveFormatsExcluding = (editor as any).getActiveFormatsExcluding.bind(editor);

      // Exclude strong
      let formats = getActiveFormatsExcluding(textNode, strongEl);
      expect(formats).toEqual(['em', 'u']);

      // Exclude em
      formats = getActiveFormatsExcluding(textNode, emEl);
      expect(formats).toEqual(['strong', 'u']);

      // Exclude underline
      formats = getActiveFormatsExcluding(textNode, underlineEl);
      expect(formats).toEqual(['strong', 'em']);
    });

    test('returns an empty array when there are no active formats', () => {
      container.innerHTML = `
        <p id="p">Plain text</p>
      `;

      const p = container.querySelector('#p')!;
      const textNode = p.firstChild!;

      const getActiveFormatsExcluding = (editor as any).getActiveFormatsExcluding.bind(editor);
      const formats = getActiveFormatsExcluding(textNode, p);

      expect(formats).toEqual([]);
    });
  });

  describe('createNestedFormatStructure', () => {
    test('creates a nested structure with multiple formats', () => {
      const formats: ['strong', 'em', 'u'] = ['strong', 'em', 'u'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: strong > em > span.underline > text
      expect(result.tagName.toLowerCase()).toBe('strong');
      expect(result.firstChild?.nodeName.toLowerCase()).toBe('em');
      expect(result.firstChild?.firstChild?.nodeName.toLowerCase()).toBe('span');
      expect((result.firstChild?.firstChild as HTMLElement).classList.contains('underline')).toBe(true);
      expect(result.firstChild?.firstChild?.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a simple structure with a single strong format', () => {
      const formats: ['strong'] = ['strong'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: strong > text
      expect(result.tagName.toLowerCase()).toBe('strong');
      expect(result.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a simple structure with a single em format', () => {
      const formats: ['em'] = ['em'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: em > text
      expect(result.tagName.toLowerCase()).toBe('em');
      expect(result.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a simple structure with a single underline format', () => {
      const formats: ['u'] = ['u'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: span.underline > text
      expect(result.tagName.toLowerCase()).toBe('span');
      expect(result.classList.contains('underline')).toBe(true);
      expect(result.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a nested structure with em and strong formats', () => {
      const formats: ['em', 'strong'] = ['em', 'strong'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: em > strong > text
      expect(result.tagName.toLowerCase()).toBe('em');
      expect(result.firstChild?.nodeName.toLowerCase()).toBe('strong');
      expect(result.firstChild?.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a nested structure with underline and em formats', () => {
      const formats: ['u', 'em'] = ['u', 'em'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: span.underline > em > text
      expect(result.tagName.toLowerCase()).toBe('span');
      expect(result.classList.contains('underline')).toBe(true);
      expect(result.firstChild?.nodeName.toLowerCase()).toBe('em');
      expect(result.firstChild?.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a nested structure with underline and strong formats', () => {
      const formats: ['u', 'strong'] = ['u', 'strong'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: span.underline > strong > text
      expect(result.tagName.toLowerCase()).toBe('span');
      expect(result.classList.contains('underline')).toBe(true);
      expect(result.firstChild?.nodeName.toLowerCase()).toBe('strong');
      expect(result.firstChild?.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a nested structure with formats in different order', () => {
      const formats: ['em', 'u', 'strong'] = ['em', 'u', 'strong'];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: em > span.underline > strong > text
      expect(result.tagName.toLowerCase()).toBe('em');
      expect(result.firstChild?.nodeName.toLowerCase()).toBe('span');
      expect((result.firstChild as HTMLElement).classList.contains('underline')).toBe(true);
      expect(result.firstChild?.firstChild?.nodeName.toLowerCase()).toBe('strong');
      expect(result.firstChild?.firstChild?.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });

    test('creates a span with zero-width space when no formats are provided', () => {
      const formats: [] = [];

      const createNestedFormatStructure = (editor as any).createNestedFormatStructure.bind(editor);
      const result = createNestedFormatStructure(formats);

      // Should create a structure: span > text
      expect(result.tagName.toLowerCase()).toBe('span');
      expect(result.firstChild?.textContent).toBe('\u200B'); // Zero-width space
    });
  });

  describe('positionCursorInNewStructure', () => {
    test('positions cursor after zero-width space in the innermost text node', () => {
      // Create a nested structure
      const structure = document.createElement('strong');
      const em = document.createElement('em');
      const textNode = document.createTextNode('\u200B'); // Zero-width space
      em.appendChild(textNode);
      structure.appendChild(em);
      container.appendChild(structure);

      const selection = window.getSelection()!;
      const positionCursorInNewStructure = (editor as any).positionCursorInNewStructure.bind(editor);
      positionCursorInNewStructure(structure);

      // The cursor should be positioned after the zero-width space
      const range = selection.getRangeAt(0);
      expect(range.startContainer).toBe(textNode);
      expect(range.startOffset).toBe(1);
      expect(range.collapsed).toBe(true);
    });
  });

  describe('unwrapListItem', () => {
    test('converts a list item to a paragraph', () => {
      container.innerHTML = `
        <ul id="list">
          <li id="item">List item text</li>
        </ul>
      `;

      const list = container.querySelector('#list')! as HTMLUListElement;
      const li = container.querySelector('#item')! as HTMLLIElement;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(li.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const unwrapListItem = (editor as any).unwrapListItem.bind(editor);
      unwrapListItem(li, list, selection);

      // The list should be replaced with a paragraph
      expect(container.querySelector('ul')).toBeNull();
      expect(container.querySelector('p')?.textContent).toBe('List item text');

      // The cursor should be positioned in the paragraph
      const newRange = selection.getRangeAt(0);
      expect(newRange.startContainer.textContent).toBe('List item text');
      expect(newRange.startOffset).toBe(0);
    });

    test('preserves nested lists when unwrapping a list item', () => {
      container.innerHTML = `
        <ul id="list">
          <li id="item">Parent item
            <ul>
              <li>Nested item 1</li>
              <li>Nested item 2</li>
            </ul>
          </li>
        </ul>
      `;

      const list = container.querySelector('#list')! as HTMLUListElement;
      const li = container.querySelector('#item')! as HTMLLIElement;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(li.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const unwrapListItem = (editor as any).unwrapListItem.bind(editor);
      unwrapListItem(li, list, selection);

      // The parent list should be replaced with a paragraph followed by the nested list
      // The paragraph might contain whitespace from the original HTML
      const paragraphText = container.querySelector('p')?.textContent || '';
      expect(paragraphText.includes('Parent item')).toBe(true);
      expect(container.querySelectorAll('ul').length).toBe(1);
      expect(container.querySelectorAll('li').length).toBe(2);

      // The cursor should be positioned in the paragraph
      const newRange = selection.getRangeAt(0);
      expect(newRange.startContainer.textContent?.includes('Parent item')).toBe(true);
    });

    test('handles unwrapping a list item from a multi-item list', () => {
      container.innerHTML = `
        <ul id="list">
          <li>First item</li>
          <li id="item">Middle item</li>
          <li>Last item</li>
        </ul>
      `;

      const list = container.querySelector('#list')! as HTMLUListElement;
      const li = container.querySelector('#item')! as HTMLLIElement;
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.setStart(li.firstChild!, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const unwrapListItem = (editor as any).unwrapListItem.bind(editor);
      unwrapListItem(li, list, selection);

      // The list should be split with a paragraph in the middle
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(2);
      expect(lists[0].children.length).toBe(1);
      expect(lists[0].children[0].textContent).toBe('First item');
      expect(lists[1].children.length).toBe(1);
      expect(lists[1].children[0].textContent).toBe('Last item');

      // There should be a paragraph between the lists
      const p = container.querySelector('p');
      expect(p?.textContent).toBe('Middle item');
      expect(p?.nextElementSibling).toBe(lists[1]);
      expect(p?.previousElementSibling).toBe(lists[0]);
    });
  });
});
