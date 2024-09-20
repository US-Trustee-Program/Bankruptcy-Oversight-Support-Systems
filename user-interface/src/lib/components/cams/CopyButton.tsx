import { forwardRef } from 'react';
import IconButton from '../IconButton';
import { ButtonRef } from '../uswds/Button';

export type CopyButtonProps = JSX.IntrinsicElements['button'];

function _CopyButton(props: CopyButtonProps, ref: React.Ref<ButtonRef>) {
  return <IconButton icon="content_copy" {...props} ref={ref} />;
}

const CopyButton = forwardRef(_CopyButton);

export default CopyButton;
