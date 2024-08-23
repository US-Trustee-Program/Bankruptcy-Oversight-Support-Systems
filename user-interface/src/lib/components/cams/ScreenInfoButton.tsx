import { UswdsButtonStyle } from '../uswds/Button';
import { ModalRefType } from '../uswds/modal/modal-refs';
import { ToggleModalButton } from '../uswds/modal/ToggleModalButton';
import { IconLabel } from './IconLabel/IconLabel';

type ScreenInfoButtonProps = {
  infoModalRef: React.RefObject<ModalRefType>;
};

export default function ScreenInfoButton(props: ScreenInfoButtonProps) {
  return (
    <ToggleModalButton
      toggleAction={'open'}
      modalId={''}
      modalRef={props.infoModalRef}
      uswdsStyle={UswdsButtonStyle.Unstyled}
      title="How to use this page"
    >
      <IconLabel label="Information" icon="info"></IconLabel>
    </ToggleModalButton>
  );
}
