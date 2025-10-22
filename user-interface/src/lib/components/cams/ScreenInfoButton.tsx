import { useRef } from 'react';
import { UswdsButtonStyle } from '../uswds/Button';
import { ModalRefType, OpenModalButtonRef } from '../uswds/modal/modal-refs';
import { IconLabel } from './IconLabel/IconLabel';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';

type ScreenInfoButtonProps = {
  infoModalRef: React.RefObject<ModalRefType | null>;
  modalId: string;
};

export default function ScreenInfoButton(props: ScreenInfoButtonProps) {
  const toggleModalButtonRef = useRef<OpenModalButtonRef>(null);

  return (
    <OpenModalButton
      modalId={props.modalId}
      modalRef={props.infoModalRef}
      ref={toggleModalButtonRef}
      uswdsStyle={UswdsButtonStyle.Unstyled}
      title="How to use this page"
    >
      <IconLabel label="Information" icon="info"></IconLabel>
    </OpenModalButton>
  );
}
