/**
 * Types and interfaces for formatting analysis in RichTextEditor2
 */

import { VNode } from './virtual-dom/VNode';

/**
 * Enum representing the state of formatting across a selection
 */
export enum FormattingState {
  /** No formatting of this type is applied to any part of the selection */
  NOT_APPLIED = 'not_applied',
  /** Some but not all text in the selection has this formatting */
  PARTIALLY_APPLIED = 'partial',
  /** All text in the selection has this formatting applied */
  FULLY_APPLIED = 'full',
}

/**
 * Interface for the result of analyzing formatting across a selection
 */
export interface FormattingAnalysis {
  /** State of bold formatting across the selection */
  bold: FormattingState;
  /** State of italic formatting across the selection */
  italic: FormattingState;
  /** State of underline formatting across the selection */
  underline: FormattingState;
  /** All virtual DOM nodes that intersect with the current selection */
  selectedNodes: VNode[];
  /** Whether there is an active text selection */
  hasSelection: boolean;
  /** Total number of text nodes in the selection */
  totalTextNodes: number;
  /** Number of text nodes with bold formatting */
  boldTextNodes: number;
  /** Number of text nodes with italic formatting */
  italicTextNodes: number;
  /** Number of text nodes with underline formatting */
  underlineTextNodes: number;
}

/**
 * Type for supported formatting types
 */
export type FormattingType = 'bold' | 'italic' | 'underline';

/**
 * Mapping from formatting type to HTML tag name
 */
export const FORMATTING_TAG_MAP: Record<FormattingType, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
} as const;
