import React from 'react';
import type { RichTextEditor3Props, RichTextEditor3Ref } from './types';
import { RichTextButton } from './RichTextButton';
import './RichTextEditor3.scss';

const RichTextEditor3 = React.forwardRef<RichTextEditor3Ref, RichTextEditor3Props>(
  (props: RichTextEditor3Props, ref: React.Ref<RichTextEditor3Ref>) => {
    const { id, label, required = false, onChange } = props;
    const [value, setValue] = React.useState<string>('');
    const [disabled, setDisabled] = React.useState<boolean>(false);

    React.useImperativeHandle(ref, () => ({
      getValue: () => value,
      setValue: (newValue: string) => {
        setValue(newValue);
      },
      clearValue: () => {
        setValue('');
      },
      disable: (isDisabled: boolean) => {
        setDisabled(isDisabled);
      },
      getHtml: () => value,
    }));

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setValue(newValue);
      if (onChange) {
        onChange(newValue);
      }
    };

    return (
      <div className="rich-text-editor3">
        {label && (
          <label htmlFor={id} className={`rich-text-editor3__label${required ? ' required' : ''}`}>
            {label}
            {required && ' *'}
          </label>
        )}
        <div className="rich-text-editor3__toolbar">
          <RichTextButton
            title="Bold"
            ariaLabel="Make text bold"
            onClick={() => {
              // Bold functionality will be implemented later
              console.log('Bold button clicked');
            }}
          >
            b
          </RichTextButton>
        </div>
        <textarea
          id={id}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className="rich-text-editor3__textarea"
        />
      </div>
    );
  },
);

RichTextEditor3.displayName = 'RichTextEditor3';

export default RichTextEditor3;
export type { RichTextEditor3Props, RichTextEditor3Ref } from './types';
