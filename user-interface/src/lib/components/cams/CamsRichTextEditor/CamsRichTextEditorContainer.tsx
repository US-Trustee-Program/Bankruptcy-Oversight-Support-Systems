import './camsRichTextEditor.scss';
import { forwardRef } from 'react';
import CamsRichTextEditor, { CamsRichTextEditorRef } from './CamsRichTextEditor';
import { Descendant } from 'slate';

export interface CamsRichTextEditorContainerProps {
  id: string;
  label: string;
  required: boolean;
  onChange: (value: string) => void;
}

const _CamsRichTextEditorContainer = (
  props: CamsRichTextEditorContainerProps,
  ref: React.Ref<CamsRichTextEditorRef>,
) => {
  const id = props.id ?? 'cams-rich-text-editor-container';

  const onEditorChange = (_value: Descendant[]) => {
    const htmlValue = (ref as React.RefObject<CamsRichTextEditorRef>).current?.toHtml();
    if (htmlValue && props.onChange) {
      props.onChange(htmlValue);
    }
  };

  return (
    <div className="usa-form-group">
      {props.label && (
        <label className="usa-label" id={id + '-label'} htmlFor={id}>
          {props.label}
          {props.required && <span className="required-form-field" />}
        </label>
      )}
      <div id={id} className="cams-rich-text-editor-container">
        <CamsRichTextEditor ref={ref} onChange={onEditorChange} />
      </div>
    </div>
  );
};

const CamsRichTextEditorContainer = forwardRef(_CamsRichTextEditorContainer);

export default CamsRichTextEditorContainer;
