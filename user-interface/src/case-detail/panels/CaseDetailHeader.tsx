import './CaseDetailHeader.scss';
import { Link } from 'react-router-dom';
import Icon from '@/lib/components/uswds/Icon';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { useEffect } from 'react';
import useFixedPosition from '@/lib/hooks/UseFixedPosition';
import { CaseDetail } from '@common/cams/cases';
import useLocationTracker from '../../lib/hooks/UseLocationTracker';

export interface CaseDetailHeaderProps {
  isLoading: boolean;
  caseId: string | undefined;
  caseDetail?: CaseDetail;
}

export default function CaseDetailHeader(props: CaseDetailHeaderProps) {
  const { isFixed, fix, loosen } = useFixedPosition();
  const courtInformation = `${props.caseDetail?.courtName} (${props.caseDetail?.courtDivisionName})`;
  // u00A0 is a non-breaking space. Using &nbsp; in the string literal does not display correctly.
  const chapterInformation = `${props.caseDetail?.petitionLabel} Chapter\u00A0${props.caseDetail?.chapter}`;
  const appEl = document.querySelector('.App');
  const camsHeader = document.querySelector('.cams-header');

  const { previousLocation, homeTab } = useLocationTracker();

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

  function getBackLinkText() {
    if (previousLocation.includes('my-cases')) return 'My Cases';
    if (previousLocation.includes('search')) return 'Case Search';
    if (previousLocation.includes('staff-assignment')) return 'Staff Assignment';
    if (previousLocation.includes('data-verification')) return 'Data Verification';
    return 'Case List';
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
              <div className="grid-col-10">
                <Link className="back-button" to={previousLocation} target={homeTab}>
                  <Icon name="arrow_back"></Icon>
                  Back to {getBackLinkText()}
                </Link>
              </div>
            </div>
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
                  title={`Court Name and District: ${courtInformation}`}
                  data-testid="court-name-and-district"
                >
                  {courtInformation}
                </h3>
              </div>
              <div className="grid-col-2">
                <h3
                  className="case-chapter"
                  title={`Case Chapter: ${chapterInformation}`}
                  data-testid="case-chapter"
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
              <Link className="back-button" to={previousLocation} target={homeTab}>
                <Icon name="arrow_back"></Icon>
                Back to {getBackLinkText()}
              </Link>
            </div>
            <div className="grid-col-1"></div>
          </div>

          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="grid-col-10">
              {props.isLoading && (
                <h1 data-testid="case-detail-heading">Loading Case Details...</h1>
              )}
              {!props.isLoading && (
                <h1 data-testid="case-detail-heading">
                  Case Details
                  {props.caseDetail && (
                    <span data-testid="case-detail-heading-title">
                      {' '}
                      - {props.caseDetail.caseTitle}
                    </span>
                  )}
                </h1>
              )}
            </div>
            <div className="grid-col-1"></div>
          </div>

          {props.isLoading && (
            <div className="grid-row grid-gap-lg" data-testid="loading-h2">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <h2 className="case-number text-no-wrap" title="Case Number">
                  {props.caseId}
                </h2>
              </div>
              <div className="grid-col-1"></div>
            </div>
          )}

          {!props.isLoading && (
            <div className="grid-row grid-gap-lg" data-testid="h2-with-case-info">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <h2 className="case-number text-no-wrap" title="Case Number">
                  {props.caseId}
                </h2>
              </div>
              <div className="grid-col-5">
                <h2
                  className="court-name"
                  title="Court Name and District"
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
      )}
    </>
  );
}
