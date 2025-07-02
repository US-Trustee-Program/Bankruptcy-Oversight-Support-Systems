/**
 * Central type definitions for RichTextEditor3 component
 */

export interface RichTextEditor3Props {
  id?: string;
  label?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

export interface RichTextEditor3Ref {
  getValue: () => string;
  setValue: (value: string) => void;
  clearValue: () => void;
  disable: (disabled: boolean) => void;
  getHtml: () => string;
}
