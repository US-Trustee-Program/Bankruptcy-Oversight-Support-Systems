import DOMPurify from 'dompurify';

export const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'span', 'a'],
  ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
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

type PrerenderedHtmlProps = {
  htmlString: string;
};

function PrerenderedHtml(props: PrerenderedHtmlProps) {
  return (
    <div
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(props.htmlString, DOMPURIFY_CONFIG) }}
    />
  );
}

export default PrerenderedHtml;
