import { useRef } from 'react';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import LocalStorage from '@/lib/utils/local-storage';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { getCamsUserReference } from '@common/cams/session';
import { SearchResults } from '@/search-results/SearchResults';
import { MyCasesResultsHeader } from './MyCasesResultsHeader';
import { MyCasesResultsRow } from './MyCasesResultsRow';
import './MyCasesScreen.scss';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';

export const MyCasesScreen = () => {
  const screenTitle = 'My Cases';

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';
  const session = LocalStorage.getSession();

  if (!session || !session.user.offices) {
    return <>Invalid user expectation</>;
  }

  const searchPredicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    assignments: [getCamsUserReference(session.user)],
  };

  const infoModalActionButtonGroup = {
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
            <ScreenInfoButton infoModalRef={infoModalRef} />
          </div>
          <SearchResults
            id="search-results"
            searchPredicate={searchPredicate}
            noResultsMessage="No cases currently assigned."
            header={MyCasesResultsHeader}
            row={MyCasesResultsRow}
          ></SearchResults>
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
        actionButtonGroup={infoModalActionButtonGroup}
      ></Modal>
    </div>
  );
};
