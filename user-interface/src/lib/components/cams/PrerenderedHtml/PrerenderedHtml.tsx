import { DOMPURIFY_CONFIG } from '@/lib/utils/sanitize-text';
import DOMPurify from 'dompurify';

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
