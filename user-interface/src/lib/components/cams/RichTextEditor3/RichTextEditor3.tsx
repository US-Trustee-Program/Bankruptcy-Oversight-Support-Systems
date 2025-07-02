import React from 'react';

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

const RichTextEditor3 = React.forwardRef<RichTextEditor3Ref, RichTextEditor3Props>(
  (props: RichTextEditor3Props, ref: React.Ref<RichTextEditor3Ref>) => {
    const { id, label, required = false } = props;

    React.useImperativeHandle(ref, () => ({
      getValue: () => '',
      setValue: (_value: string) => {
        // Simple dumb component - does nothing for now
      },
      clearValue: () => {
        // Simple dumb component - does nothing for now
      },
      disable: (_disabled: boolean) => {
        // Simple dumb component - does nothing for now
      },
      getHtml: () => '',
    }));

    return (
      <div>
        {label && (
          <label htmlFor={id} className={required ? 'required' : ''}>
            {label}
            {required && ' *'}
          </label>
        )}
        <div id={id} style={{ border: '1px solid #ccc', padding: '8px', minHeight: '100px' }}>
          <p>RichTextEditor3 - Simple dumb component (does nothing for now)</p>
        </div>
      </div>
    );
  },
);

RichTextEditor3.displayName = 'RichTextEditor3';

export default RichTextEditor3;
