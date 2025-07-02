/**
 * Error Recovery Strategy Implementation
 * Implementation of DECISION-013: Error Recovery Strategy
 */

import { EditorState } from './EditorState';
import { VNode } from '../virtual-dom/VNode';

/**
 * Error recovery interface for handling synchronization issues
 * Virtual DOM serves as the definitive source of truth
 */
export interface ErrorRecoveryStrategy {
  /** Recover from virtual DOM/real DOM synchronization issues */
  recoverFromDesync(virtualDOM: VNode, realDOM: Element): EditorState;
  /** Extract and preserve user's active typing content */
  preserveActiveContent(realDOM: Element): string;
  /** Log recovery events for debugging without exposing to users */
  logRecoveryEvent(error: Error, context: unknown): void;
  /** Check if recovery is needed by comparing virtual and real DOM */
  needsRecovery(virtualDOM: VNode, realDOM: Element): boolean;
}

/**
 * Recovery context information for debugging
 */
export interface RecoveryContext {
  /** Type of error that triggered recovery */
  errorType: 'sync_mismatch' | 'selection_invalid' | 'dom_corruption' | 'unknown';
  /** Timestamp when error occurred */
  timestamp: number;
  /** User action that triggered the error */
  userAction?: string;
  /** Current editor mode when error occurred */
  editorMode?: string;
  /** Additional debugging information */
  debugInfo?: Record<string, unknown>;
}

/**
 * Implementation of error recovery strategy
 * Prioritizes virtual DOM state while preserving user experience
 */
export class ErrorRecoveryStrategyImpl implements ErrorRecoveryStrategy {
  private recoveryCount: number = 0;
  private readonly maxRecoveryAttempts: number = 5;
  private readonly recoveryTimeout: number = 1000; // 1 second
  private lastRecoveryTime: number = 0;

  recoverFromDesync(virtualDOM: VNode, realDOM: Element): EditorState {
    const now = Date.now();

    // Prevent recovery loops
    if (this.isRecoveryLooping(now)) {
      this.logRecoveryEvent(new Error('Recovery loop detected, using fallback strategy'), {
        recoveryCount: this.recoveryCount,
        lastRecoveryTime: this.lastRecoveryTime,
      });
      return this.fallbackRecovery(virtualDOM);
    }

    this.recoveryCount++;
    this.lastRecoveryTime = now;

    try {
      // 1. Preserve any actively typed content
      const activeContent = this.preserveActiveContent(realDOM);

      // 2. Use virtual DOM as source of truth to rebuild state
      const recoveredState = this.rebuildStateFromVirtualDOM(virtualDOM, activeContent);

      // 3. Log the recovery event for debugging
      this.logRecoveryEvent(new Error('DOM synchronization recovered'), {
        errorType: 'sync_mismatch',
        timestamp: now,
        activeContent,
        virtualDOMNodeCount: this.countNodes(virtualDOM),
        realDOMNodeCount: realDOM.childNodes.length,
      } as RecoveryContext);

      return recoveredState;
    } catch (error) {
      // If recovery fails, use fallback
      this.logRecoveryEvent(error as Error, {
        errorType: 'unknown',
        timestamp: now,
        recoveryAttempt: this.recoveryCount,
      });
      return this.fallbackRecovery(virtualDOM);
    }
  }

  preserveActiveContent(realDOM: Element): string {
    try {
      // Look for currently focused element or active text input
      const { activeElement } = document;

      if (
        activeElement &&
        realDOM.contains(activeElement) &&
        (activeElement.nodeType === Node.TEXT_NODE || activeElement.textContent)
      ) {
        return activeElement.textContent || '';
      }

      // Get current selection and preserve any selected text
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (realDOM.contains(range.commonAncestorContainer)) {
          return range.toString();
        }
      }

      // As a last resort, preserve the last text node content
      const lastTextNode = this.findLastTextNode(realDOM);
      return lastTextNode?.textContent || '';
    } catch (error) {
      this.logRecoveryEvent(error as Error, {
        errorType: 'unknown',
        context: 'preserveActiveContent',
      });
      return '';
    }
  }

  logRecoveryEvent(error: Error, context: unknown): void {
    // Log to console in development, send to monitoring in production
    if (process.env.NODE_ENV === 'development') {
      console.warn('RichTextEditor2 Recovery Event:', {
        error: error.message,
        stack: error.stack,
        context,
      });
    } else {
      // In production, send to monitoring service
      // This is a placeholder for actual monitoring integration
      this.sendToMonitoring(error, context);
    }
  }

  needsRecovery(virtualDOM: VNode, realDOM: Element): boolean {
    try {
      // Compare basic structure between virtual and real DOM
      const virtualNodeCount = this.countNodes(virtualDOM);
      const realNodeCount = this.countRealDOMNodes(realDOM);

      // Allow for some variance due to zero-width spaces and formatting
      const tolerance = Math.max(2, Math.ceil(virtualNodeCount * 0.1));

      if (Math.abs(virtualNodeCount - realNodeCount) > tolerance) {
        return true;
      }

      // Check for obvious corruption signs
      if (this.hasCorruptionSigns(realDOM)) {
        return true;
      }

      // Check selection validity
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (!realDOM.contains(range.commonAncestorContainer)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // If checking itself fails, assume recovery is needed
      this.logRecoveryEvent(error as Error, { context: 'needsRecovery check failed' });
      return true;
    }
  }

  /**
   * Rebuild editor state using virtual DOM as source of truth
   */
  private rebuildStateFromVirtualDOM(virtualDOM: VNode, activeContent: string): EditorState {
    // Create a clean state based on virtual DOM
    const newState: EditorState = {
      virtualDOM: virtualDOM,
      selection: {
        startPath: [0],
        startOffset: 0,
        endPath: [0],
        endOffset: 0,
        isCollapsed: true,
      },
      currentEditorMode: 'IDLE',
    };

    // If we have active content, try to position cursor at the end
    if (activeContent) {
      const position = this.findContentPosition(virtualDOM, activeContent);
      if (position) {
        newState.selection = {
          startPath: position.path,
          startOffset: position.offset,
          endPath: position.path,
          endOffset: position.offset,
          isCollapsed: true,
        };
      }
    }

    return newState;
  }

  /**
   * Fallback recovery when normal recovery fails
   */
  private fallbackRecovery(virtualDOM: VNode): EditorState {
    return {
      virtualDOM: virtualDOM,
      selection: {
        startPath: [0],
        startOffset: 0,
        endPath: [0],
        endOffset: 0,
        isCollapsed: true,
      },
      currentEditorMode: 'IDLE',
    };
  }

  /**
   * Check if we're in a recovery loop
   */
  private isRecoveryLooping(now: number): boolean {
    return (
      this.recoveryCount >= this.maxRecoveryAttempts &&
      now - this.lastRecoveryTime < this.recoveryTimeout
    );
  }

  /**
   * Count nodes in virtual DOM tree
   */
  private countNodes(node: VNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  /**
   * Count nodes in real DOM tree
   */
  private countRealDOMNodes(element: Element): number {
    let count = 1;
    Array.from(element.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        count += this.countRealDOMNodes(child as Element);
      } else {
        count += 1;
      }
    });
    return count;
  }

  /**
   * Check for obvious signs of DOM corruption
   */
  private hasCorruptionSigns(realDOM: Element): boolean {
    // Check for common corruption patterns
    const html = realDOM.innerHTML;

    // Look for malformed HTML
    if (html.includes('<br></br>') || html.includes('<<') || html.includes('>>')) {
      return true;
    }

    // Check for excessive nesting
    const depth = this.getMaxDepth(realDOM);
    if (depth > 20) {
      return true;
    }

    // Check for orphaned text nodes
    const textNodes = this.getDirectTextNodes(realDOM);
    if (textNodes.length > 2) {
      // More than 2 direct text children might indicate corruption
      return true;
    }

    return false;
  }

  /**
   * Get maximum depth of DOM tree
   */
  private getMaxDepth(element: Element, currentDepth: number = 0): number {
    let maxDepth = currentDepth;

    Array.from(element.children).forEach((child) => {
      const childDepth = this.getMaxDepth(child, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    });

    return maxDepth;
  }

  /**
   * Get direct text node children
   */
  private getDirectTextNodes(element: Element): Text[] {
    const textNodes: Text[] = [];

    Array.from(element.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        textNodes.push(child as Text);
      }
    });

    return textNodes;
  }

  /**
   * Find the last text node in DOM tree
   */
  private findLastTextNode(element: Element): Text | null {
    // Traverse in reverse order to find last text node
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
      const child = element.childNodes[i];

      if (child.nodeType === Node.TEXT_NODE) {
        return child as Text;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const result = this.findLastTextNode(child as Element);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Find position of content in virtual DOM
   */
  private findContentPosition(
    _virtualDOM: VNode,
    _content: string,
  ): { path: number[]; offset: number } | null {
    // This is a simplified implementation
    // In a real implementation, this would search for the content position
    return { path: [0], offset: 0 };
  }

  /**
   * Send error to monitoring service (placeholder)
   */
  private sendToMonitoring(_error: Error, _context: unknown): void {
    // Placeholder for actual monitoring service integration
    // In production, this would send to services like Sentry, DataDog, etc.
  }
}

/**
 * Helper class for managing recovery state
 */
export class RecoveryManager {
  private strategy: ErrorRecoveryStrategy;
  private isRecovering: boolean = false;

  constructor(strategy: ErrorRecoveryStrategy) {
    this.strategy = strategy;
  }

  /**
   * Attempt recovery if needed
   */
  async attemptRecovery(
    virtualDOM: VNode,
    realDOM: Element,
    onRecovered?: (newState: EditorState) => void,
  ): Promise<EditorState | null> {
    if (this.isRecovering) {
      return null; // Prevent concurrent recovery attempts
    }

    try {
      this.isRecovering = true;

      if (!this.strategy.needsRecovery(virtualDOM, realDOM)) {
        return null; // No recovery needed
      }

      const recoveredState = this.strategy.recoverFromDesync(virtualDOM, realDOM);

      if (onRecovered) {
        onRecovered(recoveredState);
      }

      return recoveredState;
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Check if currently in recovery process
   */
  isCurrentlyRecovering(): boolean {
    return this.isRecovering;
  }
}
