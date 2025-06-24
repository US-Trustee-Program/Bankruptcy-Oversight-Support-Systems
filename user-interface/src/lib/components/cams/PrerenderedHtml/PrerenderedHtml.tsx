import DOMPurify from 'dompurify';
import { DOMPURIFY_CONFIG } from '../RichTextEditor/Editor.constants';

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
