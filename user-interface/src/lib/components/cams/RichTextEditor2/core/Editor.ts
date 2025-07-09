import {
  OnContentChangeCallback,
  OnSelectionUpdateCallback,
  OnFormattingChangeCallback,
  EditorState,
  VDOMNode,
  VDOMSelection,
  EditorCommand,
  FSMResult,
} from './types';
import { FSM } from './FSM';
import { vdomToHTML } from './io/VDOMToHTML';
import { SelectionService } from './selection/SelectionService.humble';
import {
  getSelectionFromBrowser,
  applySelectionToBrowser,
  getFormatStateAtSelection,
} from './model/VDOMSelection';

export interface EditorOptions {
  rootElement?: HTMLDivElement | null;
  onChange: OnContentChangeCallback;
  onSelectionChange?: OnSelectionUpdateCallback;
  onFormattingChange?: OnFormattingChangeCallback;
  selectionService: SelectionService;
}

export class Editor {
  private rootElement: HTMLDivElement | null;
  private state: EditorState;
  private fsm: FSM;
  private onChange: OnContentChangeCallback;
  private onSelectionChange?: OnSelectionUpdateCallback;
  private onFormattingChange?: OnFormattingChangeCallback;
  private selectionService: SelectionService;
  private eventCleanupFunctions: (() => void)[] = [];

  constructor(options: EditorOptions) {
    this.onChange = options.onChange;
    this.onSelectionChange = options.onSelectionChange;
    this.onFormattingChange = options.onFormattingChange;
    this.selectionService = options.selectionService;
    this.fsm = new FSM();
    this.rootElement = options.rootElement || null;

    // Initialize with empty state
    const emptySelection: VDOMSelection = {
      start: { offset: 0 },
      end: { offset: 0 },
      isCollapsed: true,
    };

    this.state = {
      vdom: [],
      selection: emptySelection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      },
    };

    // Notify of initial state
    this.notifyChange();
    this.notifyFormattingChange();
  }

  /**
   * Updates the selection state and notifies via callback
   */
  updateSelection(selection: VDOMSelection): void {
    this.state.selection = selection;
    this.notifySelectionChange();
    this.notifyFormattingChange();
  }

  getHtml(): string {
    return vdomToHTML(this.state.vdom);
  }

  getValue(): string {
    return vdomToHTML(this.state.vdom);
  }

  setValue(value: string): void {
    // For now, just clear the VDOM and set as plain text
    // TODO: Implement HTML to VDOM conversion
    this.state.vdom = [];
    if (value) {
      const textNode: VDOMNode = {
        id: `text-${Date.now()}`,
        type: 'text',
        content: value,
      };
      this.state.vdom = [textNode];
    }
    this.notifyChange();
  }

  clearValue(): void {
    this.state.vdom = [];
    this.notifyChange();
  }

  /**
   * Updates the root element reference and sets up DOM interactions
   */
  setRootElement(rootElement: HTMLDivElement | null): void {
    // Clean up existing event listeners
    this.cleanupEventListeners();

    this.rootElement = rootElement;

    if (rootElement) {
      // Set the initial HTML content
      rootElement.innerHTML = this.getHtml();

      // Set up event listeners
      this.setupEventListeners(rootElement);
    }
  }

  /**
   * Sets up event listeners on the root element
   */
  private setupEventListeners(element: HTMLDivElement): void {
    // Add beforeinput event listener to capture user input
    const handleBeforeInput = (e: Event) => {
      const inputEvent = e as InputEvent;
      const handled = this.handleBeforeInput(inputEvent);
      // Only prevent default for certain event types to allow testing library to work
      // Don't prevent insertText events as this breaks user.type() in tests
      if (handled && inputEvent.inputType !== 'insertText') {
        e.preventDefault();
      }
    };

    // Add keydown event listener to capture arrow keys and other navigation
    const handleKeyDown = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      this.handleKeyDown(keyEvent);
    };

    // Add click event listener to capture mouse clicks for cursor positioning
    const handleClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      this.handleClick(mouseEvent);
    };

    element.addEventListener('beforeinput', handleBeforeInput);
    element.addEventListener('keydown', handleKeyDown);
    element.addEventListener('click', handleClick);

    // Store cleanup functions
    this.eventCleanupFunctions.push(
      () => element.removeEventListener('beforeinput', handleBeforeInput),
      () => element.removeEventListener('keydown', handleKeyDown),
      () => element.removeEventListener('click', handleClick),
    );
  }

  /**
   * Cleans up all event listeners
   */
  private cleanupEventListeners(): void {
    this.eventCleanupFunctions.forEach((cleanup) => cleanup());
    this.eventCleanupFunctions = [];
  }

  handleBeforeInput(event: InputEvent): boolean {
    // Don't sync selection from browser during beforeinput events as it can interfere
    // with rapid character input sequences (like user.type() in tests)
    // The selection will be properly managed by the FSM state updates

    let command: EditorCommand;

    // Map input events to FSM commands
    if (event.inputType === 'insertText' && event.data) {
      command = {
        type: 'INSERT_TEXT',
        payload: event.data,
      };
    } else if (event.inputType === 'deleteContentBackward') {
      command = {
        type: 'BACKSPACE',
      };
    } else if (event.inputType === 'insertParagraph') {
      command = {
        type: 'ENTER_KEY',
      };
    } else {
      // Unhandled input type, don't handle it
      return false;
    }

    // Delegate to FSM
    const result = this.fsm.processCommand(command, this.state);
    event.preventDefault();

    // Debug logging
    console.log('FSM result:', {
      command: command.type,
      payload: command.payload,
      didChange: result.didChange,
      oldSelection: this.state.selection,
      newSelection: result.newSelection,
      oldVDOM: this.state.vdom.map((n) => ({ id: n.id, type: n.type, content: n.content })),
      newVDOM: result.newVDOM.map((n) => ({ id: n.id, type: n.type, content: n.content })),
    });

    if (result.didChange) {
      this.state.vdom = result.newVDOM;
      this.state.selection = result.newSelection;
      this.notifyChange();
      this.notifySelectionChange();
    } else if (result.newSelection !== this.state.selection) {
      // If only selection changed but not content
      this.state.selection = result.newSelection;
      this.notifySelectionChange();
    }

    // Return true to indicate we handled the event
    return true;
  }

  /**
   * Synchronizes the selection from the browser to the VDOM
   */
  private syncSelectionFromBrowser(): void {
    if (!this.selectionService) {
      return;
    }

    try {
      // Get selection from browser and update VDOM selection
      this.state.selection = getSelectionFromBrowser(this.selectionService);
    } catch (error) {
      console.error('Error synchronizing selection:', error);
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    // Sync selection from browser if we have a selection service
    this.syncSelectionFromBrowser();

    // Handle keyboard shortcuts first

    // Special direct handling for Cmd+B on Mac or Ctrl+B on Windows
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      console.log(
        'Bold keyboard shortcut detected - ctrlKey:',
        event.ctrlKey,
        'metaKey:',
        event.metaKey,
        'key:',
        event.key,
      );
      console.trace('Bold keyboard shortcut stack trace');
      event.preventDefault();

      console.log('Directly calling toggleBold()');
      this.toggleBold();
      return; // Exit early after handling the shortcut
    }

    let command: EditorCommand | null = null;

    // Handle arrow keys for cursor movement
    switch (event.key) {
      case 'ArrowLeft':
        command = {
          type: 'MOVE_CURSOR_LEFT',
        };
        break;
      case 'ArrowRight':
        command = {
          type: 'MOVE_CURSOR_RIGHT',
        };
        break;
      case 'ArrowUp':
        command = {
          type: 'MOVE_CURSOR_UP',
        };
        break;
      case 'ArrowDown':
        command = {
          type: 'MOVE_CURSOR_DOWN',
        };
        break;
      default:
        // Unhandled key, ignore
        return;
    }

    if (command) {
      // Delegate to FSM
      event.preventDefault();
      console.log('Sending command to FSM:', command);

      const result = this.fsm.processCommand(command, this.state);
      console.log('FSM result received:', {
        didChange: result.didChange,
        newVDOM: result.newVDOM,
        selectionChanged: result.newSelection !== this.state.selection,
      });

      this.handleFSMResult(result);
    }
  }

  private handleFSMResult(result: FSMResult): void {
    // Update format toggle state if present
    const formatToggleStateChanged = result.formatToggleState !== undefined;
    if (formatToggleStateChanged) {
      this.state.formatToggleState = result.formatToggleState!;
    }

    if (result.didChange) {
      this.state.vdom = result.newVDOM;
      this.state.selection = result.newSelection;

      // After text insertion, reset toggle state to match actual formatting at cursor
      // This prevents the toggle state from persisting after text is inserted
      if (result.formatToggleState === undefined) {
        // Only reset if the FSM didn't explicitly set a new toggle state
        this.state.formatToggleState = {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        };
      }

      this.notifyChange();
      this.notifySelectionChange();
      this.notifyFormattingChange();
    } else if (result.newSelection !== this.state.selection) {
      // If only selection changed but not content
      this.state.selection = result.newSelection;
      this.notifySelectionChange();
      this.notifyFormattingChange();
    } else if (formatToggleStateChanged) {
      // If only toggle state changed, still notify formatting change
      this.notifyFormattingChange();
    }
  }

  handleClick(event: MouseEvent): void {
    if (event.type !== 'click') {
      return;
    }

    // Sync selection from browser after click
    // This uses DOM range/selection APIs to get the current browser selection
    // and convert it to a VDOM selection
    this.syncSelectionFromBrowser();

    // The browser has already updated its selection based on the click
    // We just need to notify of the selection change

    // Create a command to set the selection explicitly
    const command: EditorCommand = {
      type: 'SET_SELECTION',
      payload: this.state.selection,
    };

    // Process the command through the FSM
    const result = this.fsm.processCommand(command, this.state);

    // Update state with the result
    this.state.vdom = result.newVDOM;
    this.state.selection = result.newSelection;

    // Only notify of content changes if content actually changed
    if (result.didChange) {
      this.notifyChange();
    }

    // Always notify of selection changes after click
    this.notifySelectionChange();
    this.notifyFormattingChange();
  }

  private notifyChange(): void {
    const html = this.getHtml();

    // Don't update DOM innerHTML during beforeinput events as it interferes with testing library
    // The DOM will be updated naturally by the browser for insertText events
    // We only need to update for other types of changes
    if (this.rootElement && this.rootElement.innerHTML !== html) {
      this.rootElement.innerHTML = html;
    }

    this.onChange(html);
  }

  /**
   * Notifies listeners of selection changes
   */
  private notifySelectionChange(): void {
    // Use the same fallback approach as syncSelectionFromBrowser for consistency
    if (!this.rootElement) {
      this.rootElement = document.getElementById('editor-content') as HTMLDivElement;
    }

    if (this.rootElement) {
      applySelectionToBrowser(this.selectionService, this.state.selection, this.rootElement);
    }

    if (this.onSelectionChange) {
      this.onSelectionChange(this.state.selection);
    }
  }

  /**
   * Notifies listeners of formatting state changes
   */
  private notifyFormattingChange(): void {
    if (this.onFormattingChange) {
      const currentFormatting = getFormatStateAtSelection(this.state.vdom, this.state.selection);
      const combinedState = {
        currentFormatting,
        toggleState: this.state.formatToggleState,
      };
      this.onFormattingChange(combinedState);
    }
  }

  // Method to get VDOM for testing purposes
  getVDOM(): VDOMNode[] {
    return this.state.vdom;
  }

  // Text editing methods
  insertText(text: string): void {
    // Process the command through the FSM
    const result = this.fsm.processCommand({ type: 'INSERT_TEXT', payload: text }, this.state);

    // Update state if there was a change
    if (result.didChange) {
      this.state.vdom = result.newVDOM;
      this.state.selection = result.newSelection;

      // Notify callbacks
      this.notifyChange();
      this.notifySelectionChange();
    }
  }

  // Formatting methods
  toggleBold(): void {
    const result = this.fsm.processCommand({ type: 'TOGGLE_BOLD', payload: null }, this.state);
    this.handleFSMResult(result);
  }
}
