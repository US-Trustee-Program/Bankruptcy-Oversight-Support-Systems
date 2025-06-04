export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type ParagraphElement = {
  type: 'paragraph';
  children: CustomText[];
};

export type CustomElement = ParagraphElement;

export type CustomEditor = BaseEditor &
  ReactEditor & {
    stickyMarks: Partial<Record<string, unknown>>;
    addStickyMarks: (key: string, value: unknown) => void;
    removeStickyMark: (key: string) => void;
  };

export type Mark = Exclude<keyof CustomText, 'text'>;
