import { useEffect, useRef, useState } from 'react';
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
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { CaseNoteInput } from '@common/cams/cases';
import { CaseNumber } from '@/lib/components/CaseNumber';
import React from 'react';
import { Cacheable } from '@/lib/utils/local-cache';
import { formatDateTime } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import useFeatureFlags, { PHONETIC_SEARCH_ENABLED } from '@/lib/hooks/UseFeatureFlags';

export const MyCasesScreen = () => {
  const screenTitle = 'My Cases';
  const featureFlags = useFeatureFlags();
  const phoneticSearchEnabled = featureFlags[PHONETIC_SEARCH_ENABLED] === true;

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';
  const session = LocalStorage.getSession();
  const [doShowClosedCases, setDoShowClosedCases] = useState(false);
  const [draftNotesCaseIds, setDraftNotesCaseIds] = useState<string[]>([]);
  const [draftNotes, setDraftNotes] = useState<Cacheable<CaseNoteInput>[]>([]);

  if (!session || !session.user.offices) {
    // TODO: This renders a blank pane with no notice to the user. Maybe this should at least return a <Stop> component with a message.
    return <></>;
  }
  const searchPredicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    assignments: [getCamsUserReference(session.user)],
    excludeMemberConsolidations: true,
    excludeClosedCases: !doShowClosedCases,
  };

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType | null>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  function handleShowClosedCasesToggle(isActive: boolean) {
    setDoShowClosedCases(isActive);
    return isActive;
  }

  function buildAlertMessage() {
    const earliestExpiry = draftNotes.reduce(
      (acc: Cacheable<CaseNoteInput> | undefined, cache: Cacheable<CaseNoteInput>) => {
        if (!acc || acc.expiresAfter > cache.expiresAfter) {
          return cache;
        }
        return acc;
      },
      undefined,
    );
    if (draftNotesCaseIds.length === 1) {
      return (
        <span className="draft-notes-alert-message">
          You have a draft case note on case{' '}
          <span className="text-no-wrap">
            <CaseNumber caseId={draftNotesCaseIds[0]} tab="notes" />
          </span>
          . <em>It will expire on {formatDateTime(new Date(earliestExpiry!.expiresAfter))}</em>.
        </span>
      );
    } else if (draftNotesCaseIds.length === 2) {
      return (
        <span className="draft-notes-alert-message">
          You have draft case notes on cases{' '}
          <span className="text-no-wrap">
            <CaseNumber caseId={draftNotesCaseIds[0]} tab="notes" />
          </span>{' '}
          and{' '}
          <span className="text-no-wrap">
            <CaseNumber caseId={draftNotesCaseIds[1]} tab="notes" />
          </span>
          .{' '}
          <em>
            The draft on case number {getCaseNumber(earliestExpiry?.value.caseId)} expires on{' '}
            {formatDateTime(new Date(earliestExpiry!.expiresAfter))}
          </em>
          .
        </span>
      );
    } else if (draftNotesCaseIds.length > 2) {
      const lastCaseId = draftNotesCaseIds[draftNotesCaseIds.length - 1];
      return (
        <span className="draft-notes-alert-message">
          You have draft case notes on cases{' '}
          {draftNotesCaseIds.slice(0, -1).map((id, index) => (
            <React.Fragment key={id}>
              {index > 0 && ', '}

              <span className="text-no-wrap">
                <CaseNumber caseId={id} tab="notes" />
              </span>
            </React.Fragment>
          ))}
          , and{' '}
          <span className="text-no-wrap">
            <CaseNumber caseId={lastCaseId} tab="notes" />
          </span>
          .{' '}
          <em>
            The draft on case number {getCaseNumber(earliestExpiry?.value.caseId)} expires on{' '}
            {formatDateTime(new Date(earliestExpiry!.expiresAfter))}
          </em>
          .
        </span>
      );
    }
    return null;
  }

  useEffect(() => {
    const caseNotePattern = /^case-notes-/;
    const draftNotesFound = LocalFormCache.getFormsByPattern<CaseNoteInput>(caseNotePattern);
    setDraftNotes(draftNotesFound.map((cache) => cache.item));

    const uniqueIds = new Set<string>();
    draftNotesFound.forEach((record) => {
      uniqueIds.add(record.item.value.caseId);
    });

    setDraftNotesCaseIds(Array.from(uniqueIds));
  }, []);

  return (
    <MainContent className="my-cases case-list">
      <DocumentTitle name="My Cases" />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-12">
          <div className="screen-heading">
            <h1 data-testid="case-list-heading">
              {screenTitle}
              <ScreenInfoButton infoModalRef={infoModalRef} modalId={infoModalId} />
            </h1>
            {draftNotesCaseIds.length > 0 && (
              <div data-testid="draft-notes-alert-test-id">
                <Alert
                  type={UswdsAlertStyle.Info}
                  role={'status'}
                  timeout={0}
                  title="Draft Notes Available"
                  show={true}
                  inline={true}
                  id="draft-notes-alert"
                >
                  {buildAlertMessage()}
                </Alert>
              </div>
            )}
          </div>

          <h3>Filters</h3>
          <div className="filters case-status">
            <div className="case-status-container">
              <div>
                <ToggleButton
                  id="closed-cases-toggle"
                  ariaLabel={'Show closed cases.'}
                  tooltipLabel={{
                    active: 'Closed cases shown.',
                    inactive: 'Closed cases hidden.',
                  }}
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
            phoneticSearchEnabled={phoneticSearchEnabled}
            noResultsMessage="No cases currently assigned."
            header={MyCasesResultsHeader}
            row={MyCasesResultsRow}
          ></SearchResults>
        </div>
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
