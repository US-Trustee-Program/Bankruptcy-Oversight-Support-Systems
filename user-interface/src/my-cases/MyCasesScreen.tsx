import './MyCasesScreen.scss';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import LocalStorage from '@/lib/utils/local-storage';
import { SearchResults } from '@/search/SearchResults';
import { CasesSearchPredicate } from '@common/api/search';
import { useRef } from 'react';

export const MyCasesScreen = () => {
  const screenTitle = 'My Cases';

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';
  const session = LocalStorage.getSession();
  const searchPredicate: CasesSearchPredicate = {
    chapters: ['15'],
    assignments: [session!.user.id],
  };

  const actionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  return (
    <div className="my-cases case-list">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <div className="screen-heading">
            <h1 data-testid="case-list-heading">{screenTitle}</h1>
            <ToggleModalButton
              toggleAction={'open'}
              modalId={''}
              modalRef={infoModalRef}
              uswdsStyle={UswdsButtonStyle.Unstyled}
            >
              <IconLabel label={'Information'} icon={'info'}></IconLabel>
            </ToggleModalButton>
          </div>
          <SearchResults id="search-results" searchPredicate={searchPredicate}></SearchResults>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <Modal
        ref={infoModalRef}
        modalId={infoModalId}
        className="assign-attorney-modal"
        heading="My Cases - Using This Page"
        content={
          <>
            My Cases allows you to view the list of cases that are assigned to you. You can view
            details about a case by clicking on its case number. Use the filters to find the case
            you wish to view.
          </>
        }
        actionButtonGroup={actionButtonGroup}
      ></Modal>
    </div>
  );
};
