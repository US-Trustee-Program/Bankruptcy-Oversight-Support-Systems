import './CaseDetailHeader.scss';

import CopyButton from '@/lib/components/cams/CopyButton';
import useFixedPosition from '@/lib/hooks/UseFixedPosition';
import { copyCaseNumber, getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseDetail } from '@common/cams/cases';
import { useEffect } from 'react';

export interface CaseDetailHeaderProps {
  caseDetail?: CaseDetail;
  caseId: string | undefined;
  isLoading: boolean;
}

export default function CaseDetailHeader(props: CaseDetailHeaderProps) {
  const { fix, isFixed, loosen } = useFixedPosition();
  const courtInformation = `${props.caseDetail?.courtName} (${props.caseDetail?.courtDivisionName})`;
  // u00A0 is a non-breaking space. Using &nbsp; in the string literal does not display correctly.
  const chapterInformation = `${props.caseDetail?.petitionLabel} Chapter\u00A0${props.caseDetail?.chapter}`;
  const appEl = document.querySelector('.App');
  const camsHeader = document.querySelector('.cams-header');

  const modifyHeader = () => {
    if (camsHeader) {
      const caseDetailHeader = document.querySelector('.case-detail-header.fixed');
      const caseDetailH1 = document.querySelector('.case-detail-header h1');
      if (caseDetailH1 && caseDetailH1.getBoundingClientRect().top < 0) {
        fix();
      } else if (
        caseDetailHeader &&
        camsHeader.getBoundingClientRect().bottom > caseDetailHeader.getBoundingClientRect().bottom
      ) {
        loosen();
      }
    }
  };

  function printH1() {
    return (
      <h1 data-testid="case-detail-heading">
        Case Details{' '}
        <span data-testid="case-detail-heading-title"> - {props.caseDetail?.caseTitle}</span>
      </h1>
    );
  }

  function printCaseIdHeader() {
    return (
      <h2 aria-label="Case ID" className="case-number text-no-wrap" title="Case ID">
        {props.caseId}{' '}
        <CopyButton
          id="header-case-id"
          onClick={() => copyCaseNumber(props.caseId)}
          title="Copy Case ID to clipboard"
        />
      </h2>
    );
  }

  useEffect(() => {
    if (!props.isLoading && appEl && camsHeader) {
      appEl.addEventListener('scroll', modifyHeader);
    }
    return () => {
      const appEl = document.querySelector('.App');
      appEl?.removeEventListener('scroll', modifyHeader);
    };
  }, [props.isLoading == false]);

  return (
    <>
      {isFixed && (
        <>
          <div className="case-detail-header fixed" data-testid="case-detail-fixed-header">
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-4">
                <h3
                  data-testid="case-detail-heading"
                  title={`Case Title: ${props.caseDetail?.caseTitle}`}
                >
                  {props.caseDetail?.caseTitle}
                </h3>
              </div>
              <div className="grid-col-1">
                <h3
                  className="case-number text-no-wrap"
                  title={`Case Number: ${getCaseNumber(props.caseId)}`}
                >
                  {getCaseNumber(props.caseId)}
                </h3>
              </div>
              <div className="grid-col-3">
                <h3
                  className="court-name"
                  data-testid="court-name-and-district"
                  title={`Court Name and District: ${courtInformation}`}
                >
                  {courtInformation}
                </h3>
              </div>
              <div className="grid-col-2">
                <h3
                  className="case-chapter"
                  data-testid="case-chapter"
                  title={`Case Chapter: ${chapterInformation}`}
                >
                  {chapterInformation}
                </h3>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </div>
          <div className="spacer-fixer"></div>
        </>
      )}
      {!isFixed && (
        <div className="case-detail-header" data-testid="case-detail-header">
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="grid-col-10">
              {props.isLoading && (
                <h1 data-testid="case-detail-heading">Loading Case Details...</h1>
              )}
              {!props.isLoading && props.caseDetail && printH1()}
            </div>
            <div className="grid-col-1"></div>
          </div>

          {props.isLoading && (
            <div className="grid-row grid-gap-lg" data-testid="loading-h2">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">{printCaseIdHeader()}</div>
              <div className="grid-col-1"></div>
            </div>
          )}

          {!props.isLoading && (
            <div className="grid-row grid-gap-lg" data-testid="h2-with-case-info">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">{printCaseIdHeader()}</div>
              <div className="grid-col-5">
                <h2
                  className="court-name"
                  data-testid="court-name-and-district"
                  title="Court Name and District"
                >
                  {courtInformation}
                </h2>
              </div>
              <div className="grid-col-3">
                <h2 className="case-chapter" data-testid="case-chapter" title="Case Chapter">
                  {chapterInformation}
                </h2>
              </div>
              <div className="grid-col-1"></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
