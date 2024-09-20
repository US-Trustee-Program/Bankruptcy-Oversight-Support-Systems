import Icon from '@/lib/components/uswds/Icon';
import Button, { ButtonRef, UswdsButtonStyle } from './uswds/Button';
import { forwardRef } from 'react';

export type IconButtonProps = JSX.IntrinsicElements['button'] & {
  disabled?: boolean;
  icon: string;
};

function _IconButton(props: IconButtonProps, ref: React.Ref<ButtonRef>) {
  return (
    <Button {...props} uswdsStyle={UswdsButtonStyle.Unstyled} ref={ref}>
      <Icon name={props.icon}></Icon>
    </Button>
  );
}

const IconButton = forwardRef(_IconButton);

export default IconButton;
