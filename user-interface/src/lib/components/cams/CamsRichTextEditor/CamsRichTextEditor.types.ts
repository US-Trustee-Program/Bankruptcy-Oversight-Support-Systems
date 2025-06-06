import { BaseEditor } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type CustomElement =
  | { type: 'paragraph'; children: CustomText[] }
  | { type: 'bulleted-list'; children: CustomElement[] }
  | { type: 'numbered-list'; children: CustomElement[] }
  | { type: 'list-item'; children: (CustomElement | CustomText)[] };

type ElementOfType<T extends CustomElement['type']> = Extract<CustomElement, { type: T }>;

export type ParagraphElement = ElementOfType<'paragraph'>;
export type BulletedListElement = ElementOfType<'bulleted-list'>;
export type NumberedListElement = ElementOfType<'numbered-list'>;
export type ListItemElement = ElementOfType<'list-item'>;

export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

export type Mark = Exclude<keyof CustomText, 'text'>;
