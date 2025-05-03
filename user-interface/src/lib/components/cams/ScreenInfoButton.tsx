import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { useRef } from 'react';

import { UswdsButtonStyle } from '../uswds/Button';
import { ModalRefType, OpenModalButtonRef } from '../uswds/modal/modal-refs';
import { IconLabel } from './IconLabel/IconLabel';

type ScreenInfoButtonProps = {
  infoModalRef: React.RefObject<ModalRefType>;
  modalId: string;
};

export default function ScreenInfoButton(props: ScreenInfoButtonProps) {
  const toggleModalButtonRef = useRef<OpenModalButtonRef>(null);

  return (
    <OpenModalButton
      modalId={props.modalId}
      modalRef={props.infoModalRef}
      ref={toggleModalButtonRef}
      title="How to use this page"
      uswdsStyle={UswdsButtonStyle.Unstyled}
    >
      <IconLabel icon="info" label="Information"></IconLabel>
    </OpenModalButton>
  );
}
