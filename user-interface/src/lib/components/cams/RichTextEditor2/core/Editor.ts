import {
  OnContentChangeCallback,
  EditorState,
  VDOMNode,
  VDOMSelection,
  EditorCommand,
} from './types';
import { FSM } from './FSM';
import { vdomToHTML } from './io/VDOMToHTML';

export interface EditorOptions {
  onChange: OnContentChangeCallback;
}

export class Editor {
  private state: EditorState;
  private fsm: FSM;
  private onChange: OnContentChangeCallback;

  constructor(options: EditorOptions) {
    this.onChange = options.onChange;
    this.fsm = new FSM();

    // Initialize with empty state
    const emptySelection: VDOMSelection = {
      start: { nodeId: '', offset: 0 },
      end: { nodeId: '', offset: 0 },
      isCollapsed: true,
    };

    this.state = {
      vdom: [],
      selection: emptySelection,
      canUndo: false,
      canRedo: false,
    };
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

  handleBeforeInput(event: InputEvent): void {
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
      // Unhandled input type, ignore
      return;
    }

    // Delegate to FSM
    const result = this.fsm.processCommand(command, this.state);

    if (result.didChange) {
      this.state.vdom = result.newVDOM;
      this.state.selection = result.newSelection;
      this.notifyChange();
    }
  }

  private notifyChange(): void {
    const html = this.getHtml();
    this.onChange(html);
  }
}
