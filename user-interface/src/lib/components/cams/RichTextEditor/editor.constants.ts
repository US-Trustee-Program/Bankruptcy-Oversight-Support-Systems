export const ZERO_WIDTH_SPACE = '​';
export const ZERO_WIDTH_SPACE_REGEX = new RegExp(ZERO_WIDTH_SPACE, 'g');
export const EMPTY_TAG_REGEX = /<([a-z][^>]*)>\s*(?:<br\s*\/?>)*\s*<\/\1>/gi;

export type RichTextFormat = 'strong' | 'em' | 'u';
