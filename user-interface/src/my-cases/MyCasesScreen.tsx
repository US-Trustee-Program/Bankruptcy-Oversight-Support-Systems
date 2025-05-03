import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';
import ToggleButton from '@/lib/components/cams/ToggleButton/ToggleButton';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import LocalStorage from '@/lib/utils/local-storage';
import SearchResults from '@/search-results/SearchResults';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';

import './MyCasesScreen.scss';

import { getCamsUserReference } from '@common/cams/session';
import { useRef, useState } from 'react';

import { MyCasesResultsHeader } from './MyCasesResultsHeader';
import { MyCasesResultsRow } from './MyCasesResultsRow';

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
    assignments: [getCamsUserReference(session.user)],
    excludeChildConsolidations: true,
    excludeClosedCases: !doShowClosedCases,
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
  };

  const infoModalActionButtonGroup = {
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType>,
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
                  ariaLabel={'Show closed cases.'}
                  id="closed-cases-toggle"
                  isActive={false}
                  label="Closed Cases"
                  onToggle={handleShowClosedCasesToggle}
                  tooltipLabel={{
                    active: 'Closed cases shown.',
                    inactive: 'Closed cases hidden.',
                  }}
                />
              </div>
            </div>
          </div>

          <SearchResults
            header={MyCasesResultsHeader}
            id="search-results"
            noResultsMessage="No cases currently assigned."
            row={MyCasesResultsRow}
            searchPredicate={searchPredicate}
          ></SearchResults>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <Modal
        actionButtonGroup={infoModalActionButtonGroup}
        className="my-cases-info-modal"
        content={
          <>
            My Cases allows you to view the list of cases that are assigned to you. You can view
            details about a case by clicking on its case number. Use the filters to find the case
            you wish to view.
          </>
        }
        heading="My Cases - Using This Page"
        modalId={infoModalId}
        ref={infoModalRef}
      ></Modal>
    </MainContent>
  );
};
