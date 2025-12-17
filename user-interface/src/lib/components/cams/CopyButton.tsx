import React, { forwardRef, type JSX } from 'react';
import IconButton from '../IconButton';
import { ButtonRef } from '../uswds/Button';

type CopyButtonProps = JSX.IntrinsicElements['button'];

function CopyButton_(props: CopyButtonProps, ref: React.Ref<ButtonRef>) {
  return <IconButton icon="content_copy" {...props} ref={ref} />;
}

const CopyButton = forwardRef(CopyButton_);
export default CopyButton;
