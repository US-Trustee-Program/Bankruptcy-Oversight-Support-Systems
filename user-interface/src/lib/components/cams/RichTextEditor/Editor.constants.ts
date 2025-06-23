export const ZERO_WIDTH_SPACE = '​';
export const ZERO_WIDTH_SPACE_REGEX = new RegExp(ZERO_WIDTH_SPACE, 'g');
export const EMPTY_TAG_REGEX = /<(p|li|span)>\s*(?:<br\s*\/?>)*\s*<\/\1>/gi;
export const CONTENT_INPUT_SELECTOR = '#rich-text-editor-content';

export const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'span', 'a'],
  ALLOWED_ATTR: ['href', 'class'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: [
    'onerror',
    'onload',
    'onclick',
    'onmouseover',
    'onmousedown',
    'onfocus',
    'onblur',
    'onkeydown',
    'onkeypress',
    'srcset',
    'src',
  ],
};

export type RichTextFormat = 'strong' | 'em' | 'u';
