/**
 * DOM Synchronization Service
 * Handles virtual DOM to real DOM patching with requestAnimationFrame optimization
 */

import { VNode, TextNode, ElementNode, FormattingNode } from '../virtual-dom/VNode';
import { EditorState } from './EditorState';
import { PathBasedSelectionService } from './PathBasedSelectionService';
import { ErrorRecoveryStrategy } from './ErrorRecoveryStrategy';

/**
 * Interface for DOM synchronization operations
 */
export interface DOMSynchronizationService {
  /** Synchronize real DOM with virtual DOM state */
  syncDOM(newState: EditorState, realDOM: Element): void;
  /** Patch DOM using simple re-render subtree strategy */
  patchDOM(oldVirtualDOM: VNode, newVirtualDOM: VNode, realDOM: Element): void;
  /** Set selection after DOM updates */
  updateSelection(state: EditorState, realDOM: Element): void;
  /** Check if DOM sync is currently in progress */
  isSyncInProgress(): boolean;
}

/**
 * Implementation of DOM synchronization with error recovery
 */
export class DOMSynchronizationServiceImpl implements DOMSynchronizationService {
  private syncInProgress: boolean = false;
  private pendingSync: (() => void) | null = null;

  constructor(
    private readonly selectionService: PathBasedSelectionService,
    private readonly errorRecovery: ErrorRecoveryStrategy,
  ) {}

  syncDOM(newState: EditorState, realDOM: Element): void {
    // Prevent concurrent sync operations
    if (this.syncInProgress) {
      // Queue the sync operation
      this.pendingSync = () => this.syncDOM(newState, realDOM);
      return;
    }

    try {
      this.syncInProgress = true;

      // Use requestAnimationFrame to batch DOM writes
      requestAnimationFrame(() => {
        try {
          this.performSync(newState, realDOM);
        } finally {
          this.syncInProgress = false;

          // Process any pending sync
          if (this.pendingSync) {
            const pending = this.pendingSync;
            this.pendingSync = null;
            pending();
          }
        }
      });
    } catch (error) {
      this.syncInProgress = false;
      this.handleSyncError(error as Error, newState, realDOM);
    }
  }

  patchDOM(oldVirtualDOM: VNode, newVirtualDOM: VNode, realDOM: Element): void {
    try {
      // Initial strategy: Find lowest common ancestor and re-render subtree
      const changeRoot = this.findChangeRoot(oldVirtualDOM, newVirtualDOM);

      if (changeRoot) {
        this.rerenderSubtree(changeRoot.newNode, changeRoot.path, realDOM);
      }
    } catch (error) {
      this.errorRecovery.logRecoveryEvent(error as Error, {
        context: 'DOM patching failed',
        operation: 'patchDOM',
      });

      // Fallback: Full re-render
      this.fullRerender(newVirtualDOM, realDOM);
    }
  }

  updateSelection(state: EditorState, realDOM: Element): void {
    try {
      // Use requestAnimationFrame to ensure DOM is updated before setting selection
      requestAnimationFrame(() => {
        this.selectionService.setBrowserSelection(state.selection, realDOM);
      });
    } catch (error) {
      this.errorRecovery.logRecoveryEvent(error as Error, {
        context: 'Selection update failed',
        selection: state.selection,
      });
    }
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Perform the actual DOM synchronization
   */
  private performSync(newState: EditorState, realDOM: Element): void {
    try {
      // 1. Update DOM structure
      this.updateDOMStructure(newState.virtualDOM, realDOM);

      // 2. Update selection (after DOM structure is updated)
      this.updateSelection(newState, realDOM);

      // 3. Verify sync was successful
      if (this.errorRecovery.needsRecovery(newState.virtualDOM, realDOM)) {
        throw new Error('DOM sync verification failed');
      }
    } catch (error) {
      this.handleSyncError(error as Error, newState, realDOM);
    }
  }

  /**
   * Update DOM structure to match virtual DOM
   */
  private updateDOMStructure(virtualDOM: VNode, realDOM: Element): void {
    // Clear existing content
    realDOM.innerHTML = '';

    // Render virtual DOM to real DOM
    this.renderVirtualDOMToRealDOM(virtualDOM, realDOM);
  }

  /**
   * Render virtual DOM node to real DOM element
   */
  private renderVirtualDOMToRealDOM(vnode: VNode, container: Element): void {
    if (vnode.type === 'text') {
      const textNode = vnode as TextNode;
      const element = document.createTextNode(textNode.content || '');
      container.appendChild(element);
      return;
    }

    if (vnode.type === 'element') {
      const elementNode = vnode as ElementNode;
      const element = document.createElement(elementNode.tagName || 'div');

      // Set attributes
      if (elementNode.attributes) {
        for (const [key, value] of Object.entries(elementNode.attributes)) {
          element.setAttribute(key, value);
        }
      }

      // Render children
      if (vnode.children) {
        for (const child of vnode.children) {
          this.renderVirtualDOMToRealDOM(child, element);
        }
      }

      container.appendChild(element);
      return;
    }

    if (vnode.type === 'formatting') {
      const formattingNode = vnode as FormattingNode;
      const element = document.createElement(formattingNode.tagName);

      // Render children
      if (vnode.children) {
        for (const child of vnode.children) {
          this.renderVirtualDOMToRealDOM(child, element);
        }
      }

      container.appendChild(element);
      return;
    }

    // Handle root node and other types by rendering children only
    if (vnode.children) {
      for (const child of vnode.children) {
        this.renderVirtualDOMToRealDOM(child, container);
      }
    }
  }

  /**
   * Find the root of changes between old and new virtual DOM
   */
  private findChangeRoot(
    oldVDOM: VNode,
    newVDOM: VNode,
    path: number[] = [],
  ): { newNode: VNode; path: number[] } | null {
    // If nodes are different at this level, this is the change root
    if (!this.nodesEqual(oldVDOM, newVDOM)) {
      return { newNode: newVDOM, path };
    }

    // Check children for changes
    const maxChildren = Math.max(oldVDOM.children?.length || 0, newVDOM.children?.length || 0);

    for (let i = 0; i < maxChildren; i++) {
      const oldChild = oldVDOM.children?.[i];
      const newChild = newVDOM.children?.[i];

      if (!oldChild && newChild) {
        // New child added
        return { newNode: newChild, path: [...path, i] };
      }

      if (oldChild && !newChild) {
        // Child removed
        return { newNode: newVDOM, path };
      }

      if (oldChild && newChild) {
        const childChange = this.findChangeRoot(oldChild, newChild, [...path, i]);
        if (childChange) {
          return childChange;
        }
      }
    }

    return null; // No changes found
  }

  /**
   * Check if two virtual DOM nodes are equal
   */
  private nodesEqual(a: VNode, b: VNode): boolean {
    if (a.type !== b.type) {
      return false;
    }

    if (a.type === 'text') {
      const aText = a as TextNode;
      const bText = b as TextNode;
      return aText.content === bText.content;
    }

    if (a.type === 'element') {
      const aElement = a as ElementNode;
      const bElement = b as ElementNode;

      if (aElement.tagName !== bElement.tagName) {
        return false;
      }

      // Compare attributes (simplified)
      const aAttrs = aElement.attributes || {};
      const bAttrs = bElement.attributes || {};

      const aKeys = Object.keys(aAttrs);
      const bKeys = Object.keys(bAttrs);

      if (aKeys.length !== bKeys.length) {
        return false;
      }

      for (const key of aKeys) {
        if (aAttrs[key] !== bAttrs[key]) {
          return false;
        }
      }
    }

    // Children count should match
    const aChildCount = a.children?.length || 0;
    const bChildCount = b.children?.length || 0;

    return aChildCount === bChildCount;
  }

  /**
   * Re-render a subtree at the given path
   */
  private rerenderSubtree(vnode: VNode, path: number[], realDOM: Element): void {
    // Find the target element in real DOM
    const targetElement = this.findElementByPath(realDOM, path);

    if (targetElement && targetElement.parentElement) {
      // Create new element
      const newElement = document.createElement('div');
      this.renderVirtualDOMToRealDOM(vnode, newElement);

      // Replace old element with new one
      if (newElement.firstChild) {
        targetElement.parentElement.replaceChild(newElement.firstChild, targetElement);
      }
    } else {
      // Fallback to full re-render
      this.fullRerender(vnode, realDOM);
    }
  }

  /**
   * Find element in real DOM by path
   */
  private findElementByPath(root: Element, path: number[]): Element | null {
    let current: Element = root;

    for (const index of path) {
      if (index >= current.children.length) {
        return null;
      }
      current = current.children[index];
    }

    return current;
  }

  /**
   * Full re-render of virtual DOM to real DOM
   */
  private fullRerender(virtualDOM: VNode, realDOM: Element): void {
    this.updateDOMStructure(virtualDOM, realDOM);
  }

  /**
   * Handle sync errors with recovery
   */
  private handleSyncError(error: Error, state: EditorState, realDOM: Element): void {
    this.errorRecovery.logRecoveryEvent(error, {
      context: 'DOM sync error',
      operation: 'syncDOM',
      errorMessage: error.message,
    });

    try {
      // Attempt error recovery
      const recoveredState = this.errorRecovery.recoverFromDesync(state.virtualDOM, realDOM);

      // Re-sync with recovered state
      this.updateDOMStructure(recoveredState.virtualDOM, realDOM);
      this.updateSelection(recoveredState, realDOM);
    } catch (recoveryError) {
      // If recovery fails, log and continue
      this.errorRecovery.logRecoveryEvent(recoveryError as Error, {
        context: 'Recovery failed after sync error',
      });
    }
  }
}

/**
 * Helper class for managing DOM update batching
 */
export class DOMUpdateBatcher {
  private pendingUpdates: Set<() => void> = new Set();
  private frameRequested: boolean = false;

  /**
   * Schedule a DOM update to be batched with others
   */
  scheduleUpdate(updateFn: () => void): void {
    this.pendingUpdates.add(updateFn);

    if (!this.frameRequested) {
      this.frameRequested = true;
      requestAnimationFrame(() => this.flushUpdates());
    }
  }

  /**
   * Execute all pending updates
   */
  private flushUpdates(): void {
    const updates = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();
    this.frameRequested = false;

    for (const update of updates) {
      try {
        update();
      } catch (error) {
        console.error('DOM update failed:', error);
      }
    }
  }

  /**
   * Clear all pending updates
   */
  clearPendingUpdates(): void {
    this.pendingUpdates.clear();
    this.frameRequested = false;
  }
}
