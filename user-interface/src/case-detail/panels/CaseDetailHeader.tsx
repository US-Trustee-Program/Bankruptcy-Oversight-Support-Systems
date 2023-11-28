import './CaseDetailHeader.scss';
import { Link } from 'react-router-dom';
import Icon from '@/lib/components/uswds/Icon';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseDetailType } from '@/lib/type-declarations/chapter-15';
import { useEffect } from 'react';

export interface CaseDetailHeaderProps {
  isLoading: boolean;
  caseId: string | undefined;
  caseDetail?: CaseDetailType;
}

export default function CaseDetailHeader(props: CaseDetailHeaderProps) {
  const courtInformation = `${props.caseDetail?.courtName} - ${props.caseDetail?.courtDivisionName}`;
  // u00A0 is a non-breaking space. Using &nbsp; in the string literal does not display correctly.
  const chapterInformation = `${props.caseDetail?.petitionLabel} Chapter\u00A0${props.caseDetail?.chapter}`;

  useEffect(() => {
    const caseH1 = document.querySelector('.case-detail-header h1');
    const caseSubHeaders = document.querySelector('.case-detail-header .sub-headers');
    if (caseH1 && caseSubHeaders) {
      window.addEventListener('scroll', () => {
        if (caseH1.getBoundingClientRect().bottom <= 20) {
          if (!caseSubHeaders.classList.contains('fixed')) caseSubHeaders.classList.add('fixed');
        } else {
          if (caseSubHeaders.classList.contains('fixed')) caseSubHeaders.classList.remove('fixed');
        }
      });
    }
  }, [props.isLoading == false]);

  return (
    <div className="case-detail-header">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <Link className="back-button" to="/case-assignment">
            <Icon name="arrow_back"></Icon>
            Back to Case List
          </Link>
        </div>
        <div className="grid-col-1"></div>
      </div>

      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1 data-testid="case-detail-heading">
            {props.isLoading && <>Loading Case Details...</>}
            {!props.isLoading && props.caseDetail?.caseTitle}
          </h1>
        </div>
        <div className="grid-col-1"></div>
      </div>

      {props.isLoading && (
        <div className="grid-row grid-gap-lg" data-testid="loading-h2">
          <div className="grid-col-1"></div>
          <div className="grid-col-10">
            <h2 className="case-number text-no-wrap" title="Case Number">
              {getCaseNumber(props.caseId)}
            </h2>
          </div>
          <div className="grid-col-1"></div>
        </div>
      )}

      {!props.isLoading && (
        <div className="grid-row grid-gap-lg sub-headers" data-testid="h2-with-case-info">
          <div className="grid-col-1"></div>
          <div className="grid-col-2">
            <h2 className="case-number text-no-wrap" title="Case Number">
              {getCaseNumber(props.caseId)}
            </h2>
          </div>
          <div className="grid-col-5">
            <h2
              className="court-name"
              title="Court Name and Distrct"
              data-testid="court-name-and-district"
            >
              {courtInformation}
            </h2>
          </div>
          <div className="grid-col-3">
            <h2 className="case-chapter" title="Case Chapter" data-testid="case-chapter">
              {chapterInformation}
            </h2>
          </div>
          <div className="grid-col-1"></div>
        </div>
      )}
    </div>
  );
}
