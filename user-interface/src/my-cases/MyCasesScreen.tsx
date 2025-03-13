import { useRef, useState } from 'react';
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
import SearchResults from '@/search-results/SearchResults';
import { MyCasesResultsHeader } from './MyCasesResultsHeader';
import { MyCasesResultsRow } from './MyCasesResultsRow';
import './MyCasesScreen.scss';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import ToggleButton from '@/lib/components/cams/ToggleButton/ToggleButton';

export const MyCasesScreen = () => {
  const screenTitle = 'My Cases';

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';
  const session = LocalStorage.getSession();
  const [doShowClosedCases, setDoShowClosedCases] = useState(false);

  if (!session || !session.user.offices) {
    // TODO: This renders a blank pane with no notice to the user. Maybe this should at least return a <Stop> component with a message.
    return <></>;
  }
  const searchPredicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    assignments: [getCamsUserReference(session.user)],
    excludeChildConsolidations: true,
    excludeClosedCases: !doShowClosedCases,
  };

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  function handleShowClosedCasesToggle(isActive: boolean) {
    setDoShowClosedCases(isActive);
    return isActive;
  }

  return (
    <MainContent className="my-cases case-list">
      <DocumentTitle name="My Cases" />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <div className="screen-heading">
            <h1 data-testid="case-list-heading">{screenTitle}</h1>
            <ScreenInfoButton infoModalRef={infoModalRef} modalId={infoModalId} />
          </div>

          <h3>Filters</h3>
          <div className="filters case-status">
            <div className="case-status-container">
              <div>
                <ToggleButton
                  id="closed-cases-toggle"
                  ariaLabel={{ active: 'Hide closed cases.', inactive: 'Show closed cases.' }}
                  isActive={false}
                  label="Closed Cases"
                  onToggle={handleShowClosedCasesToggle}
                />
              </div>
            </div>
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
        className="my-cases-info-modal"
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
    </MainContent>
  );
};
