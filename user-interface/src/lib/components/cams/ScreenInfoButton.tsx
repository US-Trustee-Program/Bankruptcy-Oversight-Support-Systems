import { useRef } from 'react';
import { UswdsButtonStyle } from '../uswds/Button';
import { ModalRefType, ToggleModalButtonRef } from '../uswds/modal/modal-refs';
import { IconLabel } from './IconLabel/IconLabel';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';

type ScreenInfoButtonProps = {
  infoModalRef: React.RefObject<ModalRefType>;
};

export default function ScreenInfoButton(props: ScreenInfoButtonProps) {
  const toggleModalButtonRef = useRef<ToggleModalButtonRef>(null);

  return (
    <ToggleModalButton
      toggleAction={'open'}
      modalId={''}
      modalRef={props.infoModalRef}
      ref={toggleModalButtonRef}
      uswdsStyle={UswdsButtonStyle.Unstyled}
      title="How to use this page"
    >
      <IconLabel label="Information" icon="info"></IconLabel>
    </ToggleModalButton>
  );
}
