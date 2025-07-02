/**
 * Phase 2.1 Editor Core
 * Main coordination service integrating all Phase 2.1 architectural components
 */

import {
  EditorState,
  createInitialEditorState,
  EditorMode,
  Selection as EditorSelection,
} from './EditorState';
import { UndoRedoService, CircularBufferUndoRedoService } from './UndoRedoService';
import {
  PathBasedSelectionService,
  PathBasedSelectionServiceImpl,
} from './PathBasedSelectionService';
import {
  BeforeInputHandler,
  BeforeInputHandlerImpl,
  BeforeInputEventManager,
} from './BeforeInputHandler';
import {
  ErrorRecoveryStrategy,
  ErrorRecoveryStrategyImpl,
  RecoveryManager,
} from './ErrorRecoveryStrategy';
import {
  DOMSynchronizationService,
  DOMSynchronizationServiceImpl,
} from './DOMSynchronizationService';
import { VNode } from '../virtual-dom/VNode';
import { createRootNode, createElementNode, createTextNode } from '../virtual-dom/VNodeFactory';

/**
 * Configuration for the Phase 2.1 editor core
 */
export interface Phase21CoreConfig {
  /** Maximum undo operations to store */
  maxUndoOperations?: number;
  /** Enable development debugging */
  enableDebugMode?: boolean;
  /** Recovery attempt limits */
  maxRecoveryAttempts?: number;
  /** Custom error handling */
  onError?: (error: Error, context: unknown) => void;
}

/**
 * Main editor core for Phase 2.1
 * Coordinates all architectural components
 */
export class Phase21EditorCore {
  private currentState: EditorState;
  private readonly undoRedoService: UndoRedoService;
  private readonly selectionService: PathBasedSelectionService;
  private readonly beforeInputHandler: BeforeInputHandler;
  private readonly errorRecovery: ErrorRecoveryStrategy;
  private readonly domSync: DOMSynchronizationService;
  private readonly recoveryManager: RecoveryManager;
  private readonly eventManager: BeforeInputEventManager;
  private readonly config: Required<Phase21CoreConfig>;
  private _recoveryIntervalId?: NodeJS.Timeout; // Add this property

  // Event listeners
  private readonly stateChangeListeners: Set<(newState: EditorState) => void> = new Set();
  private readonly errorListeners: Set<(error: Error) => void> = new Set();

  constructor(initialVirtualDOM: VNode, config: Phase21CoreConfig = {}) {
    // Set up configuration with defaults
    this.config = {
      maxUndoOperations: config.maxUndoOperations ?? 100,
      enableDebugMode: config.enableDebugMode ?? false,
      maxRecoveryAttempts: config.maxRecoveryAttempts ?? 5,
      onError: config.onError ?? ((error) => console.error('Editor error:', error)),
    };

    // Initialize state
    this.currentState = createInitialEditorState(initialVirtualDOM);

    // Initialize services
    this.selectionService = new PathBasedSelectionServiceImpl();
    this.errorRecovery = new ErrorRecoveryStrategyImpl();
    this.recoveryManager = new RecoveryManager(this.errorRecovery);
    this.domSync = new DOMSynchronizationServiceImpl(this.selectionService, this.errorRecovery);
    this.undoRedoService = new CircularBufferUndoRedoService(
      this.currentState,
      this.config.maxUndoOperations,
    );
    this.beforeInputHandler = new BeforeInputHandlerImpl(
      this.undoRedoService,
      this.selectionService,
    );

    // Set up event management
    this.eventManager = new BeforeInputEventManager(this.beforeInputHandler, (newState) =>
      this.updateState(newState),
    );

    if (this.config.enableDebugMode) {
      this.setupDebugLogging();
    }
  }

  /**
   * Initialize the editor with a DOM element
   */
  initialize(editorElement: HTMLElement): void {
    try {
      // Set up event listeners
      this.eventManager.setupEventListener(editorElement, () => this.currentState);

      // Initial DOM sync
      this.domSync.syncDOM(this.currentState, editorElement);

      // Set up recovery monitoring
      this.setupRecoveryMonitoring(editorElement);

      this.log('Editor initialized successfully');
    } catch (error) {
      this.handleError(error as Error, { context: 'initialization' });
    }
  }

  /**
   * Get current editor state
   */
  getCurrentState(): EditorState {
    return this.currentState;
  }

  /**
   * Update editor state
   */
  updateState(newState: EditorState): void {
    const previousState = this.currentState;
    this.currentState = newState;

    // Notify listeners
    this.notifyStateChange(newState);

    this.log('State updated', {
      previousMode: previousState.currentEditorMode,
      newMode: newState.currentEditorMode,
      selectionChanged: !this.selectionsEqual(previousState.selection, newState.selection),
    });
  }

  /**
   * Synchronize state with DOM element
   */
  syncWithDOM(editorElement: HTMLElement): void {
    try {
      this.domSync.syncDOM(this.currentState, editorElement);
    } catch (error) {
      this.handleError(error as Error, { context: 'DOM sync' });
    }
  }

  /**
   * Undo last operation
   */
  undo(): boolean {
    try {
      const undoState = this.undoRedoService.undo();
      if (undoState) {
        this.updateState(undoState);
        return true;
      }
      return false;
    } catch (error) {
      this.handleError(error as Error, { context: 'undo operation' });
      return false;
    }
  }

  /**
   * Redo last undone operation
   */
  redo(): boolean {
    try {
      const redoState = this.undoRedoService.redo();
      if (redoState) {
        this.updateState(redoState);
        return true;
      }
      return false;
    } catch (error) {
      this.handleError(error as Error, { context: 'redo operation' });
      return false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoRedoService.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.undoRedoService.canRedo();
  }

  /**
   * Transition editor mode
   */
  transitionMode(newMode: EditorMode): void {
    if (this.currentState.currentEditorMode !== newMode) {
      const newState = {
        ...this.currentState,
        currentEditorMode: newMode,
      };
      this.updateState(newState);
    }
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: (newState: EditorState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Add error listener
   */
  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Destroy the editor and clean up resources
   */
  destroy(): void {
    this.stateChangeListeners.clear();
    this.errorListeners.clear();
    this.undoRedoService.clear();

    // Clear recovery monitoring interval
    if (this._recoveryIntervalId) {
      clearInterval(this._recoveryIntervalId);
      this._recoveryIntervalId = undefined;
    }

    this.log('Editor destroyed');
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      currentState: this.currentState,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      syncInProgress: this.domSync.isSyncInProgress(),
      isRecovering: this.recoveryManager.isCurrentlyRecovering(),
      config: this.config,
    };
  }

  /**
   * Trigger manual recovery if needed
   */
  async triggerRecoveryIfNeeded(editorElement: HTMLElement): Promise<boolean> {
    try {
      const recoveredState = await this.recoveryManager.attemptRecovery(
        this.currentState.virtualDOM,
        editorElement,
        (newState) => this.updateState(newState),
      );

      return recoveredState !== null;
    } catch (error) {
      this.handleError(error as Error, { context: 'manual recovery' });
      return false;
    }
  }

  /**
   * Set up recovery monitoring
   */
  private setupRecoveryMonitoring(editorElement: HTMLElement): void {
    // Monitor for potential issues every few seconds
    const checkInterval = 5000; // 5 seconds

    const checkRecovery = () => {
      if (!this.recoveryManager.isCurrentlyRecovering()) {
        this.triggerRecoveryIfNeeded(editorElement);
      }
    };

    // Set up periodic check
    const intervalId = setInterval(checkRecovery, checkInterval);

    // Store interval ID for cleanup
    this._recoveryIntervalId = intervalId;
  }

  /**
   * Notify state change listeners
   */
  private notifyStateChange(newState: EditorState): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(newState);
      } catch (error) {
        this.handleError(error as Error, { context: 'state change notification' });
      }
    });
  }

  /**
   * Handle errors with recovery and notification
   */
  private handleError(error: Error, context: unknown): void {
    this.config.onError(error, context);

    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  /**
   * Set up debug logging
   */
  private setupDebugLogging(): void {
    this.onStateChange((state) => {
      this.log('State change', {
        mode: state.currentEditorMode,
        selection: state.selection,
        virtualDOMType: state.virtualDOM.type,
      });
    });

    this.onError((error) => {
      this.log('Error occurred', { error: error.message, stack: error.stack });
    });
  }

  /**
   * Debug logging helper
   */
  private log(message: string, data?: unknown): void {
    if (this.config.enableDebugMode) {
      console.log(`[Phase21EditorCore] ${message}`, data || '');
    }
  }

  /**
   * Compare two selections for equality
   */
  private selectionsEqual(a: EditorSelection, b: EditorSelection): boolean {
    return (
      JSON.stringify(a.startPath) === JSON.stringify(b.startPath) &&
      a.startOffset === b.startOffset &&
      JSON.stringify(a.endPath) === JSON.stringify(b.endPath) &&
      a.endOffset === b.endOffset &&
      a.isCollapsed === b.isCollapsed
    );
  }
}

/**
 * Factory function to create Phase 2.1 editor core
 */
export function createPhase21EditorCore(
  initialVirtualDOM: VNode,
  config?: Phase21CoreConfig,
): Phase21EditorCore {
  // Validate required parameters
  if (!initialVirtualDOM) {
    throw new Error('Invalid virtual DOM provided to createPhase21EditorCore');
  }

  return new Phase21EditorCore(initialVirtualDOM, config);
}

/**
 * Utility function to create initial paragraph virtual DOM
 */
export function createInitialParagraphVirtualDOM(): VNode {
  // Create root node
  const rootNode = createRootNode({ endOffset: 1 });

  // Create paragraph element
  const paragraphNode = createElementNode('p', {
    parent: rootNode,
    startOffset: 0,
    endOffset: 1,
    depth: 1,
  });

  // Create text node with zero-width space
  const textNode = createTextNode('\u200B', {
    parent: paragraphNode,
    startOffset: 0,
    endOffset: 1,
    depth: 2,
  });

  // Set up parent-child relationships
  paragraphNode.children = [textNode];
  rootNode.children = [paragraphNode];

  return rootNode;
}
