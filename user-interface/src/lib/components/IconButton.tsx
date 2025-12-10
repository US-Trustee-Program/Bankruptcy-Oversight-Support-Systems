import Icon from '@/lib/components/uswds/Icon';
import Button, { ButtonRef, UswdsButtonStyle } from './uswds/Button';
import React, { forwardRef, type JSX } from 'react';

type IconButtonProps = JSX.IntrinsicElements['button'] & {
  disabled?: boolean;
  icon: string;
};

function IconButton_(props: IconButtonProps, ref: React.Ref<ButtonRef>) {
  return (
    <Button {...props} uswdsStyle={UswdsButtonStyle.Unstyled} ref={ref}>
      <Icon name={props.icon}></Icon>
    </Button>
  );
}

const IconButton = forwardRef(IconButton_);
export default IconButton;
