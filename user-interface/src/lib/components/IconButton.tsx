import Icon from '@/lib/components/uswds/Icon';
import { forwardRef } from 'react';

import Button, { ButtonRef, UswdsButtonStyle } from './uswds/Button';

export type IconButtonProps = JSX.IntrinsicElements['button'] & {
  disabled?: boolean;
  icon: string;
};

function _IconButton(props: IconButtonProps, ref: React.Ref<ButtonRef>) {
  return (
    <Button {...props} ref={ref} uswdsStyle={UswdsButtonStyle.Unstyled}>
      <Icon name={props.icon}></Icon>
    </Button>
  );
}

const IconButton = forwardRef(_IconButton);

export default IconButton;
